import express from "express";
import  { scheduleJob } from "node-schedule";
import dotenv from "dotenv";
import { logMessage, logError } from "./utils.js";
import { authorizeCharging } from "./gigacharger_utils.js";
import * as path from "path";
import {
    VEHICLE_HOME_LATITUDE,
    VEHICLE_HOME_LONGITUDE,
    lockVehicle,
    unlockVehicle,
    findVehicle,
    isVehicleInTargetLocation,
    openFrunk
} from "./tessie_utils.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Polyfill __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();
const app = express();

const SETTINGS_FILE = "settings.json";
const USAGE_PASSWORD = process.env.USAGE_PASSWORD;

const checkUsagePasswordMiddleware = (req, res, next) => {
    const providedPassword = req.query.password;
    if (providedPassword !== USAGE_PASSWORD) {
        logError(`Unauthorized access attempt: ${req.originalUrl}`);
        return res.status(401).send("Unauthorized");
    }
    next();
};

const dailyChargingJob = scheduleJob('0 22 * * *', async () => {
    logMessage("Starting job: daily charging");
    try {
        const isVehicleAtHome = await isVehicleInTargetLocation(
            VEHICLE_HOME_LATITUDE,
            VEHICLE_HOME_LONGITUDE
        );
        if (isVehicleAtHome) {
            try {
                logMessage("Vehicle at home location - authorizing charging...");
                await authorizeCharging();
                logMessage("Charging authorized");
            } catch (error) {
                throw new Error(`Could not authorize charging: ${error.message}`)
            }
        } else {
            throw new Error("Daily charging job aborted - vehicle is not at home location");
        }
    } catch (error) {
        logError(`Daily charging job failed: ${error.message}`)
    }
});

app.get("/vehicle/unlock", checkUsagePasswordMiddleware, async (req, res) => {
    try {
        await unlockVehicle();
        logMessage("Vehicle unlocked");
        res.status(200).send("Vehicle unlocked");
    } catch (error) {
        logError(`Could not unlock vehicle: ${error.message}`);
        res.status(500).send("Unable to unlock vehicle");
    }
});

app.get("/vehicle/lock", checkUsagePasswordMiddleware, async (req, res) => {
    try {
        await lockVehicle();
        logMessage("Vehicle locked");
        res.status(200).send("Vehicle locked");
    } catch (error) {
        logError(`Could not lock vehicle: ${error.message}`);
        res.status(500).send("Unable to lock vehicle");
    }
});

app.get("/vehicle/frunk", checkUsagePasswordMiddleware, async (req, res) => {
    try {
        await openFrunk();
        logMessage("Opened frunk");
        res.status(200).send("Frunk open");
    } catch (error) {
        logError(`Could not open frunk: ${error.message}`);
        res.status(500).send("Unable to open frunk");
    }
});

/**
 * @route Find vehicle
 * @description Flash the lights on the vehicle to find it easily
 * @param {number} [numberOfFlashes] - How many times to flash the lights (default 3)
 * @param {boolean} [useHorn] - Whether to also trigger the horn before flashing the lights (default false)
 * @returns {void} 200 - Request is successful
 * @returns {Error} 500 - Internal Server Error
 */
app.get("/vehicle/find", checkUsagePasswordMiddleware, async (req, res) => {
    try {
        const numberOfFlashes = parseInt(req.query.numberOfFlashes) || 3;
        const useHorn = req.query.useHorn === "true";
        logMessage(`Attempting to trigger find vehicle with numberOfFlashes = ${numberOfFlashes} and useHorn = ${useHorn}...`);
        await findVehicle(numberOfFlashes, useHorn);
        res.status(200).send("Find vehicle triggered - lights should now flash");
    } catch (error) {
        logError(`Could not trigger find vehicle: ${error.message}`);
    }
});

/**
 * @route Authorize charging
 * @description Use the Gigacharger API to authorize a charging session
 * @param {string} [charger] - Charger ID (optional) - if null, will use the one 
 * from the environment variables
 * @returns {void} 200 - If charging has been successfully authorized
 * @returns {Error} 500 - Internal Server Error
 */
app.get("/gigacharger/start", checkUsagePasswordMiddleware, async (req, res) => {
    try {
        await authorizeCharging();
        logMessage("Charging authorized");
        res.status(200).send("Charging authorized");
        return;
    } catch (error) {
        logError(`Could not authorize charging: ${error}`)
        res.status(500).send(`Could not authorize charging: ${error}`);
    }
});

app.get("/", async (req, res) => {
    res.status(200).send("The server is running");
});

app.get("/.well-known/appspecific/com.tesla.3p.public-key.pem", async (req, res) => {
    const filePath = path.join(__dirname, "keys", "public-key.pem");
    res.sendFile(filePath, (error) => {
        if (error) {
            logError("Error providing the public key as a file:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

app.listen(3000, "0.0.0.0", () => logMessage("Server running on http://localhost:3000"));