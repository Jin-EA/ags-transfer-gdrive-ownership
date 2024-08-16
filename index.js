const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

// Paths to the credentials and token files
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Scopes for Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Create an OAuth2 client with the given credentials, and then execute the callback function.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(callback) {
    fs.readFile(CREDENTIALS_PATH, (err, content) => {
        if (err) {
            console.error('Error loading client secret file:', err);
            return;
        }
        const credentials = JSON.parse(content);
        const { client_id, client_secret, redirect_uris } = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        fs.readFile(TOKEN_PATH, (err, token) => {
            if (err) return getAccessToken(oAuth2Client, callback);
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client);
        });
    });
}

/**
 * Get and store new token after prompting for user authorization.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this URL:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                console.error('Error retrieving access token', err);
                return;
            }
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Transfer ownership of a file to another user.
 */
async function transferOwnership(auth, fileId, newOwnerEmail) {
    const drive = google.drive({ version: 'v3', auth });

    try {
        // Create a new permission for the new owner
        const newPermission = await drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'writer', // Temporarily set role to writer
                type: 'user',
                emailAddress: newOwnerEmail,
            },
        });

        // Update the new permission to be owner
        await drive.permissions.update({
            fileId: fileId,
            permissionId: newPermission.data.id,
            resource: {
                role: 'owner',
            },
            transferOwnership: true, // Required for transferring ownership
        });

        console.log(`Ownership transfer requested for file (${fileId}) to ${newOwnerEmail}.`);
    } catch (err) {
        console.error('Error transferring ownership:', err);
    }
}

/**
 * Find the file ID by the file name.
 */
async function findFileIdByName(auth, fileName) {
    const drive = google.drive({ version: 'v3', auth });
    try {
        const res = await drive.files.list({
            q: `name='${fileName}'`,
            fields: 'files(id, name)',
        });

        if (res.data.files.length === 0) {
            console.log('No files found with that name.');
            return null;
        } else {
            res.data.files.forEach(file => {
                console.log(`Found file: ${file.name} (ID: ${file.id})`);
            });
            return res.data.files[0].id; // Assuming the first file is the correct one
        }
    } catch (err) {
        console.error('Error searching for files:', err);
        return null;
    }
}

/**
 * Main function to handle the file transfer process.
 */
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the file name: ', async (fileName) => {
        rl.question('Enter the Gmail address of the new owner: ', async (newOwnerEmail) => {
            rl.close();

            // Authorize and get the OAuth2 client
            authorize(async (auth) => {
                const fileId = await findFileIdByName(auth, fileName);

                if (fileId) {
                    // Request ownership transfer
                    await transferOwnership(auth, fileId, newOwnerEmail);
                }
            });
        });
    });
}

main().catch(console.error);


// npm init -y, npm i
// To run: Nodenode index.js
// Mission Status: Failed
// Missing Requirement: Transfer of Ownership to other account.
// Source: ChatGPT. 
// Remarks: 4 hours of work. There are others who accomplish this. They are great devs. And there are many, like me, who fail.
// I don't expect for them to call me again. Hihi! Nice experience. As Rechel said, I lack something in the code and in my ways of thinking. I accomplish the File sharing immediately but I struggle with the Transfer of Ownership part. Quite Challenging and exciting.