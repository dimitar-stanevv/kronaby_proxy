import { default as axios } from "axios";
import FormData from "form-data";
import WebSocket from "ws";
import { Agent } from "https";
import { logMessage, logError } from "./utils.js";
import dotenv from "dotenv";

dotenv.config();

const GIGACHARGER_API_HOST = "https://core.gigacharger.net/v1";
const GIGACHARGER_WS_URL = "wss://ws.gigacharger.net:41414";

const GIGACHARGER_EMAIL = process.env.GIGACHARGER_EMAIL;
const GIGACHARGER_PASSWORD = process.env.GIGACHARGER_PASSWORD;
const MY_CHARGER_ID = process.env.GIGACHARGER_MY_CHARGER_ID;

// Use a suitable user agent string for making the requests to Gigacharger
const GIGACHARGER_USER_AGENT = "Mozilla/5.0 (Linux; Android 11; sdk_gphone_arm64 Build/RSR1.210722.013.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36";

// Keep the Gigacharger session identifier in memory once we have it
var savedGigachargerSessionID;

/**
 * Log in to Gigacharger to obtain a session ID via a cookie.
 * @param {string} email - The email for Gigacharger
 * @param {string} password - The password for Gigacharger
 * @returns {Promise<String>} - A new valid session ID
 * @throws If the login request fails, an exception is thrown
 */
async function obtainGigachargerSessionID(email, password) {
    const formData = new FormData();
    formData.append("remember", "1");
    formData.append("email", email);
    formData.append("password", password);
    const loginResponse = await axios.post(`${GIGACHARGER_API_HOST}/login`, formData, {
        headers: {
            "User-Agent": GIGACHARGER_USER_AGENT,
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
}

/**
 * Authorize a charging session.
 * @returns {Promise<void>} - When the charging session is authorized successfully
 * @throws If the request fails, an exception is thrown
 */
export async function authorizeCharging() {
    return new Promise(async (resolve, reject) => {
        const chargerID = MY_CHARGER_ID;
        if (!chargerID) {
            logError("No charger ID supplied - check env variables");
            reject("No charger ID supplied");
        }
        logMessage(`Starting authorization for charger ID ${chargerID}`);
        try {
            if (!savedGigachargerSessionID) {
                logMessage("Not authenticated with Gigacharger - attempting to log in...");
                const email = GIGACHARGER_EMAIL;
                const password = GIGACHARGER_PASSWORD;
                if (!email || !password) {
                    logError("No credentials for Gigacharger supplied - check env variables");
                    reject("No Gigacharger credentials supplied");
                }
                try {
                    savedGigachargerSessionID = await obtainGigachargerSessionID(email, password);
                    logMessage(`Login successful - session ID is ${savedGigachargerSessionID}`)
                } catch (gigachargerLoginError) {
                    logError(`Could not log in to Gigacharger: ${gigachargerLoginError}`);
                    reject("Could not log in to Gigacharger");
                }
            }
            try {
                const webSocket = new WebSocket(GIGACHARGER_WS_URL, {
                    headers: {
                        "User-Agent": GIGACHARGER_USER_AGENT,
                        "Cookie": `manix-sess=${savedGigachargerSessionID}`,
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                        "Accept-Encoding": "gzip, deflate",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    agent: new Agent({
                        rejectUnauthorized: false
                    })
                });

                setTimeout(() => {
                    webSocket.close(1000);
                }, 40000); // Timeout after 40 seconds
    
                webSocket.on("open", () => {
                    const message = `["drain/start","${chargerID}"]`;
                    webSocket.send(message, (error) => {
                        if (error) {
                            reject(new Error("Could not authorize charging - error sending the start command"));
                        }
                    });
                });

                webSocket.on("message", function message(data) {
                    // The message should look like this:
                    // ["session",[10334,1441,0.001,7400,1],null]
                    logMessage(`Response from Gigacharger: ${data}`);
                    const match = data.match(/\[([^\]]+)\]/);
                    if (match) {
                        const arrayString = match[1];
                        const resultArray = arrayString.split(',').map(Number);
                        logMessage(`Energy transfer: ${resultArray[1] / 1000} kWh`);
                    }
                    resolve();
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
                    } else {
                        logError("Gigacharger request timed out");
                        reject(new Error("Gigacharger request timed out"));
                    }
                });
            } catch (error) {
                logError(`WebSocket error: ${error}`);
                reject(`WebSocket error: ${error}`);
            }
        } catch (error) {
            logError(`Could not authorize charging: ${error}`);
            reject(`Could not authorize charging: ${error}`);
        }
    });
}