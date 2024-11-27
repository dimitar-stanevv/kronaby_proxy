/**
 * Get the current date and time as a formatted string
 * @returns The current date and time in the following format: 24-Nov-2024 19:05:33.394
 */
export function getDateTime() {
    const now = new Date();

    const day = now.getDate().toString().padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[now.getMonth()];
    const year = now.getFullYear();

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export const headersAsString = (headers) =>
    Object.entries(headers)
        .map(([key, value]) => `\t -> ${key}: ${value}`)
        .join('\n');

export function logMessage(message) {
    console.log(`[${getDateTime()}] ${message}`);
}

export function logError(errorMessage) {
    console.error(`[${getDateTime()}] ${errorMessage}`);
}