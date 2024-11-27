import { default as axios } from "axios";
import { default as haversine } from "haversine-distance";
import dotenv from "dotenv";
import { logMessage, headersAsString } from "./utils.js";

dotenv.config();

const TESSIE_API_URL = "https://api.tessie.com";
const TESSIE_TOKEN = process.env.TESSIE_TOKEN;
const TESSIE_VIN = process.env.TESSIE_VIN;

export const VEHICLE_HOME_LATITUDE = process.env.VEHICLE_HOME_LATITUDE;
export const VEHICLE_HOME_LONGITUDE = process.env.VEHICLE_HOME_LONGITUDE;

// Create an Axios instance for calling the Tessie API
const tessieApiClient = axios.create({
    baseURL: `${TESSIE_API_URL}/${TESSIE_VIN}`,
    headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${TESSIE_TOKEN}`
    }
});

tessieApiClient.interceptors.request.use((config) => {
    logMessage("Outgoing request to Tessie API:\n" +
        `\t${config.method.toString().toUpperCase()} ${config.baseURL}${config.url}\n` +
        `\tHeaders: \n${headersAsString(config.headers)}\n` +
        `\tData: ${config.data}`
    );
    return config;
});

/**
 * Use the Tessie API to get if the vehicle is at a given location
 * @param {number} targetLatitude - Latitude of location to check
 * @param {number} targetLongitude - Longitude of location to check
 * @param {number} radius - The radius (accuracy) in meters - default 100m
 */
export async function isVehicleInTargetLocation(targetLatitude, targetLongitude, radius = 100) {
    const locationResponse = await tessieApiClient.get("/location");
    const { latitude, longitude } = locationResponse.data;

    const targetLocation = { latitude: targetLatitude, longitude: targetLongitude };
    const vehicleLocation = { latitude: latitude, longitude: longitude };
    return haversine(targetLocation, vehicleLocation) <= radius;
}

/**
 * Send an "unlock" command to the vehicle without waiting for the result
 * @returns {void}
 */
export async function unlockVehicle() {
    await tessieApiClient.post(
        "/command/unlock?wait_for_completion=false",
        null
    );
}

/**
 * Send a "lock" command to the vehicle without waiting for the result
 * @returns {void}
 */
export async function lockVehicle() {
    await tessieApiClient.post(
        "/command/lock?wait_for_completion=false",
        null
    );
}

export async function openFrunk() {
    await tessieApiClient.post(
        "/command/activate_front_trunk",
        null
    );
}

/**
 * Flash the lights on the vehicle to find it easily
 * @param {number} numberOfFlashes - The number of times to flash the lights
 * @param {boolean} useHorn - Whether to use the horn before flashing the lights
 * @returns {void}
 * @throws {Error} - An error is thrown in case the vehicle cannot be reached
 */
export async function findVehicle(numberOfFlashes, useHorn) {
    if (numberOfFlashes < 0 || numberOfFlashes > 5) {
        throw new Error("Number of flashes must be between 0 and 5");
    }
    // First we need to make sure the vehicle is awake, as we need
    // precise timing for the horn and sequential light flashes
    const wakeResponse = await tessieApiClient.post("/wake");
    const isSuccessful = wakeResponse.data.result;
    if (!isSuccessful) {
        throw new Error("Vehicle wake result is false");
    }
    
    if (useHorn) {
        const hornResponse = await tessieApiClient.post("/command/honk");
        const hornSuccessful = hornResponse.data.result;
        if (!hornSuccessful) {
            throw new Error("Horn command failed");
        }
    }

    for (let i = 0; i < numberOfFlashes; i++) {
        const flashResponse = await tessieApiClient.post("/command/flash?retry_duration=5");
        const flashSuccessful = flashResponse.data.result;
        if (!flashSuccessful) {
            throw new Error(`Flash lights command failed on iteration ${i + 1}`);
        }
    }
}