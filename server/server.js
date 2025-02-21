const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware setup
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "..", "public")));

const SCORE_FILE = path.join(__dirname, "userdetailsscore.json");

// Ensure JSON file exists on server startup
async function ensureScoreFile() {
    try {
        await fs.access(SCORE_FILE);
    } catch (error) {
        console.log("⚠ Creating new userdetailsscore.json file...");
        await fs.writeFile(SCORE_FILE, JSON.stringify([]), "utf8");
    }
}
ensureScoreFile();

// Load leaderboard from file
async function loadLeaderboard() {
    try {
        const data = await fs.readFile(SCORE_FILE, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("❌ Error reading leaderboard file:", error);
        return [];
    }
}

// Save leaderboard to file
async function saveLeaderboard(leaderboard) {
    try {
        await fs.writeFile(SCORE_FILE, JSON.stringify(leaderboard, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Error saving leaderboard:", error);
    }
}

// WebSocket Connection Handler
wss.on("connection", async (ws) => {
    console.log("✅ New WebSocket connection");

    let leaderboard = await loadLeaderboard();
    leaderboard = addPositions(leaderboard);
    ws.send(JSON.stringify({ type: "leaderboard", leaderboard }));

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === "registerPlayer") {
                leaderboard = await registerPlayer(data.name, data.qid);
                ws.send(JSON.stringify({ type: "registered", success: true, leaderboard }));
            }

            if (data.type === "updateScore") {
                leaderboard = await updateLeaderboard(data.name, data.qid, data.score);
                broadcastLeaderboard(leaderboard);
            }
        } catch (error) {
            console.error("❌ Error processing message:", error);
        }
    });

    ws.on("close", () => console.log("❌ WebSocket disconnected"));
    ws.on("error", (error) => console.error("⚠ WebSocket error:", error));
});

// Register new player
async function registerPlayer(playerName, playerId) {
    let leaderboard = await loadLeaderboard();
    let player = leaderboard.find((p) => p.qid === playerId);

    if (!player) {
        leaderboard.push({ name: playerName, qid: playerId, score: 0 });
        leaderboard = addPositions(leaderboard);
        await saveLeaderboard(leaderboard);
    }

    return leaderboard;
}

// Update player score
async function updateLeaderboard(playerName, playerId, newScore) {
    let leaderboard = await loadLeaderboard();
    let player = leaderboard.find((p) => p.qid === playerId);

    if (player) {
        player.score = Math.max(player.score, newScore);
    } else {
        leaderboard.push({ name: playerName, qid: playerId, score: newScore });
    }

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = addPositions(leaderboard);
    await saveLeaderboard(leaderboard);

    return leaderboard;
}

// Assign Positions
function addPositions(leaderboard) {
    return leaderboard.map((player, index) => ({
        ...player,
        position: index + 1
    }));
}

// Broadcast leaderboard to all players
function broadcastLeaderboard(leaderboard) {
    leaderboard = addPositions(leaderboard);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "leaderboard", leaderboard }));
        }
    });
}

// API: Fetch Leaderboard Data
app.get("/api/leaderboard", async (req, res) => {
    try {
        const leaderboard = await loadLeaderboard();
        res.json(leaderboard);
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API: Add Score via HTTP POST request
app.post("/add-score", async (req, res) => {
    try {
        const { name, qid, score } = req.body;

        // Validate input data
        if (!name || !qid || isNaN(score)) {
            return res.status(400).json({ error: "Invalid input data" });
        }

        let leaderboard = await updateLeaderboard(name, qid, parseInt(score));
        res.json({ success: true, leaderboard });

        broadcastLeaderboard(leaderboard); // Update all WebSocket clients
    } catch (error) {
        console.error("❌ Error saving score:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// Serve HTML files
app.get("/addstudentplayers", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "addstudentplayers.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
