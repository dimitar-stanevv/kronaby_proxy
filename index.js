import express from "express";
import { post } from "axios";
import FormData from "form-data";
import WebSocket from "ws";
import { Agent } from "https";
const app = express();

const GIGACHARGER_API_HOST = "https://core.gigacharger.net/v1"
const GIGACHARGER_WS_URL = "wss://ws.gigacharger.net:41414"

// Use a suitable user agent for making the requests:
const USER_AGENT = "Mozilla/5.0 (Linux; Android 11; sdk_gphone_arm64 Build/RSR1.210722.013.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36";

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
        const loginResponse = await post(`${GIGACHARGER_API_HOST}/login`, formData, {
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
 * Authorize and start a charging session.
 * @param {string} sessionID - A valid Gigacharger session ID
 * @param {string} chargerID - The charger to use
 * @returns {Promise<void>} - When the charging session starts successfully
 * @throws If the request fails, an exception is thrown
 */
async function startCharging(sessionID, chargerID) {
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
                        reject(new Error("Could not start charging - error sending the start command"));
                    } else {
                        resolve();
                    }
                });
            });
        
            webSocket.on("error", (error) => {
                reject(new Error(`Could not connect to Gigacharger's WebSocket: ${error}`));
            });
        
            webSocket.on('close', (code, reason) => {
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

app.get("/gigacharger/start", async (req, res) => {
    try {
        const { session, charger } = req.query;
        if (!session || !charger) {
            res.status(400).send("Unable to start charging: missing sesion ID and/or charger ID");
        }
        await startCharging(session, charger);
        res.status(200).send("Charging started")
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/gigacharger/login", async (req, res) => {
    try {
        const { email, password } = req.query;
        if (!email || !password) {
            res.status(400).send("Unable to log in to Gigacharger: missing credentials");
        }
        const sessionID = await obtainGigachargerSessionID(email, password);
        res.status(200).send(`Logged in. Session = ${sessionID}`)
    } catch (error) {
        res.status(500).send(`Unable to log in to Gigacharger: ${error}`);
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));