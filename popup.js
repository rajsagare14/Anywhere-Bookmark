// popup.js
const CLIENT_ID = '800012449337-k5ueq834dmiqt1u1ss22mmt5ckabt8pn.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCFzE4YEctifon51NuBtUOWjctMZNwUUVg';

let accessToken = null;

document.addEventListener('DOMContentLoaded', async () => {
    const signInButton = document.getElementById('signIn');
    const saveButton = document.getElementById('save');
    const loadButton = document.getElementById('load');
    const signOutButton = document.getElementById('signOut');
    const statusDiv = document.getElementById('status');
    const signInPage = document.getElementById('signInPage');
    const mainPage = document.getElementById('mainPage');
    const bookmarkList = document.getElementById('bookmarkList');

    async function authenticate() {
        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&scope=https://www.googleapis.com/auth/drive.appdata`,
                    interactive: true
                },
                (redirectUrl) => {
                    if (chrome.runtime.lastError || !redirectUrl) {
                        return reject(chrome.runtime.lastError || 'No redirect URL');
                    }
                    try {
                        const urlParams = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
                        accessToken = urlParams.get('access_token');
                        if (accessToken) {
                            chrome.storage.local.set({ accessToken });
                            showMainPage();
                        }
                        resolve(accessToken);
                    } catch (err) {
                        reject('Failed to extract access token');
                    }
                }
            );
        });
    }

    function showMainPage() {
        signInPage.style.display = 'none';
        mainPage.style.display = 'block';
    }

    function showSignInPage() {
        signInPage.style.display = 'block';
        mainPage.style.display = 'none';
    }
    
    function displayBookmarks(bookmarks) {
        bookmarkList.innerHTML = '';
        const traverse = (nodes) => {
            nodes.forEach(node => {
                if (node.url) {
                    const li = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = node.url;
                    link.target = '_blank';
                    link.textContent = node.title || node.url;
                    li.appendChild(link);
                    bookmarkList.appendChild(li);
                }
                if (node.children) {
                    traverse(node.children);
                }
            });
        };
        traverse(bookmarks);
    }

    async function uploadToDrive(bookmarks) {
        try {
            if (!accessToken) accessToken = await authenticate();

            const metadata = {
                name: 'bookmarks.json',
                parents: ['appDataFolder'],
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
            form.append("file", new Blob([JSON.stringify(bookmarks)], { type: "application/json" }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });

            const data = await response.json();
            statusDiv.innerText = 'Bookmarks saved!';
            console.log('Uploaded:', data);

        } catch (err) {
            console.error('Upload error:', err);
            statusDiv.innerText = 'Error saving bookmarks';
        }
    }

    async function downloadFromDrive() {
        try {
            if (!accessToken) accessToken = await authenticate();

            const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%22bookmarks.json%22&spaces=appDataFolder', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const files = await response.json();

            if (files.files.length > 0) {
                const fileId = files.files[0].id;
                const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                const bookmarks = await fileResponse.json();
                displayBookmarks(bookmarks);
                statusDiv.innerText = 'Bookmarks loaded!';
            } else {
                statusDiv.innerText = 'No bookmark file found.';
            }
        } catch (err) {
            console.error('Download error:', err);
            statusDiv.innerText = 'Error loading bookmarks';
        }
    }

    signInButton.addEventListener('click', authenticate);
    signOutButton.addEventListener('click', () => {
        accessToken = null;
        chrome.storage.local.remove('accessToken');
        showSignInPage();
    });

    saveButton.addEventListener('click', () => {
        chrome.bookmarks.getTree(uploadToDrive);
    });

    loadButton.addEventListener('click', downloadFromDrive);

    chrome.storage.local.get('accessToken', (result) => {
        if (result.accessToken) {
            accessToken = result.accessToken;
            showMainPage();
        }
    });
});