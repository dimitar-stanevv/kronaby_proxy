import { default as axios } from "axios";
import { headersAsString, logMessage } from "./utils.js";
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AUDIENCE = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const SCOPES = [
    "openid",
    "offline_access",
    "vehicle_device_data",
    "vehicle_location",
    "vehicle_cmds",
    "vehicle_charging_cmds"
];

const teslaAuthApiClient = axios.create({
    baseURL: "https://auth.tesla.com/oauth2"
});

const teslaFleetApiClient = axios.create({
    baseURL: AUDIENCE
});

teslaAuthApiClient.interceptors.request.use((config) => {
    logMessage("Outgoing request to Tesla Authentication API:\n" +
        `\t${config.method.toString().toUpperCase()} ${config.baseURL}${config.url}\n` +
        `\tHeaders: \n${headersAsString(config.headers)}\n` +
        `\tData: ${config.data}`
    );
    return config;
});

export async function generatePartnerToken() {
    const response = await teslaAuthApiClient.post("/oauth2/v3/token",
        qs.stringify({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: SCOPES.join(" "),
            audience: AUDIENCE
        }),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
    );
    const token = response.data["token"];
    const expiresIn = response.data["expires_in"];
    const tokenType = response.data["token_type"];
    logMessage(`Obtained partner token from Tesla Authentication API. Token is 
        "${tokenType}" and expires in ${expiresIn / 3600} hour(s)`);
    return token;
}

export async function registerApplication() {
    const response = teslaFleetApiClient.post("/api/1/partner_accounts")
}