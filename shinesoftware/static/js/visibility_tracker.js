// shinesoftware/static/js/visibility_tracker.js
(function() {
    if (typeof WebSocket === 'undefined') {
        console.warn("[VisibilityTracker] WebSockets not supported by this browser. Tracking disabled.");
        return;
    }

    let activitySocket = null; // Renamed for clarity, as it handles more than just visibility

    function connectActivitySocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsURL = wsProtocol + window.location.host + '/ws/client_activity/';

        console.log('[ClientActivity] Attempting to connect to WebSocket:', wsURL);
        activitySocket = new WebSocket(wsURL);

        activitySocket.onopen = function(e) {
            console.log('[ClientActivity] WebSocket connection established.');
            // Send initial visibility state
            sendVisibilityStatus(document.visibilityState === 'visible');
            // Send client timezone
            sendClientTimezone();
        };

        activitySocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            console.log('[ClientActivity] Message from server:', data);

            // **** NEW: Handle force_redirect command ****
            if (data.type === 'force_redirect' && data.url) {
                console.log('[ClientActivity] Received force_redirect command. Redirecting to:', data.url);
                try {
                    // Attempt to navigate. Using replace to prevent back button to this intermediate state.
                    window.location.replace(data.url);
                } catch (err) {
                    // Fallback if replace fails (e.g. due to browser restrictions on certain schemes)
                    console.error('[ClientActivity] window.location.replace failed, trying href:', err);
                    window.location.href = data.url;
                }
            }
            // **** END NEW ****
        };

        activitySocket.onclose = function(e) {
            console.warn('[ClientActivity] WebSocket connection closed. Code:', e.code, 'Reason:', e.reason);
            // Optional: Implement a robust reconnection strategy if needed.
            // For now, let's not auto-reconnect to avoid spamming connections if server is down.
            // setTimeout(connectActivitySocket, 10000); // Example: try reconnecting after 10s
        };

        activitySocket.onerror = function(err) {
            console.error('[ClientActivity] WebSocket error:', err);
        };
    }

    function sendVisibilityStatus(isVisible) {
        if (activitySocket && activitySocket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'visibility_change',
                visible: isVisible,
                timestamp: new Date().toISOString()
            };
            activitySocket.send(JSON.stringify(message));
            console.log('[ClientActivity] Sent visibility status:', isVisible);
        } else {
            console.warn('[ClientActivity] WebSocket not open. Cannot send visibility status.');
        }
    }

    function sendClientTimezone() {
        if (activitySocket && activitySocket.readyState === WebSocket.OPEN) {
            try {
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (timezone) {
                    const message = {
                        type: 'client_timezone_update',
                        timezone: timezone,
                        timestamp: new Date().toISOString()
                    };
                    activitySocket.send(JSON.stringify(message));
                    console.log('[ClientActivity] Sent client timezone:', timezone);
                } else {
                    console.warn('[ClientActivity] Could not determine client timezone via Intl API.');
                }
            } catch (error) {
                console.error('[ClientActivity] Error getting/sending client timezone:', error);
            }
        } else {
            console.warn('[ClientActivity] WebSocket not open. Cannot send client timezone.');
        }
    }

    // Listen for visibility changes using the Page Visibility API
    if (typeof document.hidden !== "undefined") { // Standard property
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                sendVisibilityStatus(false); // Page is hidden
            } else {
                sendVisibilityStatus(true);  // Page is visible
            }
        });
    } else if (typeof document.msHidden !== "undefined") { // IE 10
        document.addEventListener('msvisibilitychange', function() {
            sendVisibilityStatus(!document.msHidden);
        });
    } else if (typeof document.webkitHidden !== "undefined") { // Chrome < 33, Opera < 18, Android < 4.4, Safari < 7.1
        document.addEventListener('webkitvisibilitychange', function() {
            sendVisibilityStatus(!document.webkitHidden);
        });
    } else {
        console.warn("[ClientActivity] Page Visibility API not fully supported. Visibility tracking may be unreliable.");
        // As a fallback, you could use window focus/blur events, but they are less reliable
        // for true tab visibility (e.g. another window covering the browser).
        // window.addEventListener('focus', () => sendVisibilityStatus(true));
        // window.addEventListener('blur', () => sendVisibilityStatus(false));
    }

    // Initial connection attempt
    connectActivitySocket();

})();