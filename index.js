import express from "express";
import { default as axios } from "axios";
import FormData from "form-data";
import WebSocket from "ws";
import { Agent } from "https";
import  { scheduleJob } from "node-schedule";
import dotenv from "dotenv";

dotenv.config();
const app = express();

const GIGACHARGER_API_HOST = "https://core.gigacharger.net/v1";
const GIGACHARGER_WS_URL = "wss://ws.gigacharger.net:41414";
const SETTINGS_FILE = "settings.json";

// Set these environment variables beforehand
const GIGACHARGER_EMAIL = process.env.GIGACHARGER_EMAIL;
const GIGACHARGER_PASSWORD = process.env.GIGACHARGER_PASSWORD;
const MY_CHARGER_ID = process.env.GIGACHARGER_MY_CHARGER_ID;
const TESSIE_TOKEN = process.env.TESSIE_TOKEN;

// Use a suitable user agent string for making the requests
const USER_AGENT = "Mozilla/5.0 (Linux; Android 11; sdk_gphone_arm64 Build/RSR1.210722.013.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36";

// Keep the session identifier in memory once we have it
var savedSessionID;

/**
 * Log in to Gigacharger to obtain a session ID via a cookie.
 * @returns {Promise<String>} - A new valid session ID
 * @throws If the login request fails, an exception is thrown
 */
async function obtainGigachargerSessionID(email, password) {
    try {
        const formData = new FormData();
        formData.append("remember", "1");
        formData.append("email", email);
        formData.append("password", password);
        const loginResponse = await axios.post(`${GIGACHARGER_API_HOST}/login`, formData, {
            headers: {
                "User-Agent": USER_AGENT,
                "X-Requested-With": "net.gigacharger.app",
                "Sec-Fetch-Site": "cross-site",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Accept-Encoding": "gzip, deflate",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "application/json",
                ...formData.getHeaders()
            }
        });
        const cookies = loginResponse.headers["set-cookie"];
        const sessionCookie = cookies.find(cookie => cookie.includes("manix-sess"));
        if (!sessionCookie) {
            throw new Error("Unable to log in to Gigacharger - no session cookie found in response");
        }
        return sessionCookie
            .split("manix-sess=")[1]
            .split(";")[0];
    } catch (error) {
        console.error("Could not log in to Gigacharger", error.message);
        throw error;
    }
}

/**
 * Authorize a charging session.
 * @param {string} sessionID - A valid Gigacharger session ID
 * @param {string} chargerID - The charger to use
 * @returns {Promise<void>} - When the charging session is authorized successfully
 * @throws If the request fails, an exception is thrown
 */
async function authorizeCharging(sessionID, chargerID) {
    return new Promise((resolve, reject) => {
        try {
            const webSocket = new WebSocket(GIGACHARGER_WS_URL, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Cookie": `manix-sess=${sessionID}`,
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Accept-Encoding": "gzip, deflate",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                agent: new Agent({
                    rejectUnauthorized: false
                })
            });

            webSocket.on("open", () => {
                const message = `["drain/start","${chargerID}"]`;
                webSocket.send(message, (error) => {
                    webSocket.close(1000);
                    if (error) {
                        reject(new Error("Could not authorize charging - error sending the start command"));
                    } else {
                        resolve();
                    }
                });
            });
        
            webSocket.on("error", (error) => {
                reject(new Error(`Could not connect to Gigacharger's WebSocket: ${error}`));
            });
        
            webSocket.on("close", (code, reason) => {
                if (code !== 1000) {
                    // A code 1000 is considered a normal closure
                    // For more info, see here:
                    // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
                    reject(new Error("Unexpected connection closure"));
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * @route Authorize charging
 * @description Use the Gigacharger API to authorize a charging session
 * @param {string} [charger] - Charger ID (optional) - if null, will use the one 
 * from the environment variables
 * @returns {void} 200 - If charging has been successfully authorized
 * @returns {Error} 500 - Internal Server Error
 */
app.get("/gigacharger/start", async (req, res) => {
    try {
        const chargerID = MY_CHARGER_ID;
        if (!chargerID) {
            console.error("No charger ID supplied - check env variables");
            res.status(400).send("No charger ID supplied");
            return;
        }
        console.log(`Starting authorization for charger ID ${chargerID}`);
        if (!savedSessionID) {
            console.log("Not authenticated with Gigacharger - attempting to log in...");
            // No saved session exists - login is required
            const email = GIGACHARGER_EMAIL;
            const password = GIGACHARGER_PASSWORD;
            if (!email || !password) {
                console.error("No credentials for Gigacharger supplied - check env variables");
                res.status(400).send("No Gigacharger credentials supplied");
            }
            try {
                savedSessionID = await obtainGigachargerSessionID(email, password);
                console.log(`Login successful - session ID is ${savedSessionID}`)
            } catch (error) {
                console.error(`Could not log in to Gigacharger: ${error}`);
                res.status(500).send("Could not log in to Gigacharger");
                return;
            }
        }
        await authorizeCharging(savedSessionID, chargerID);
        console.log("Charging authorized");
        res.status(200).send("Charging authorized");
        return;
    } catch (error) {
        console.error(`Could not authorize charging: ${error}`)
        res.status(500).send(`Could not authorize charging: ${error}`);
    }
});

app.listen(3000, "0.0.0.0", () => console.log("Server running on http://localhost:3000"));