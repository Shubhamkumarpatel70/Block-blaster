document.addEventListener("DOMContentLoaded", function () {
    const ws = new WebSocket("ws://localhost:8080"); // WebSocket Connection

    // UI Elements
    const playerEntry = document.getElementById("playerEntry");
    const gameContainer = document.getElementById("gameContainer");
    const playerDisplay = document.getElementById("playerDisplay");
    const playerIdDisplay = document.getElementById("playerIdDisplay");
    const timerDisplay = document.getElementById("timer");
    const scoreDisplay = document.getElementById("score");
    const leaderboardList = document.getElementById("leaderboard-list");

    const startButton = document.getElementById("startButton");
    const quitButton = document.getElementById("quitButton");
    const gameCanvas = document.getElementById("gameCanvas");
    const ctx = gameCanvas.getContext("2d");

    const placeSound = document.getElementById("placeSound");
    const blastSound = document.getElementById("blastSound");

    const blockSize = 50;
    const gridSize = 8;
    gameCanvas.width = blockSize * gridSize;
    gameCanvas.height = blockSize * gridSize;

    let score = 0;
    let timer = 60;
    let placedBlocks = [];
    let playerName = "";
    let playerId = "";
    let gameInterval;
    let leaderboardData = [];

    function drawGrid() {
        ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;

        for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * blockSize, 0);
            ctx.lineTo(i * blockSize, gameCanvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * blockSize);
            ctx.lineTo(gameCanvas.width, i * blockSize);
            ctx.stroke();
        }

        drawBlocks();
    }

    function drawBlocks() {
        placedBlocks.forEach(block => {
            ctx.fillStyle = "#FFD700";
            ctx.fillRect(block.x, block.y, blockSize, blockSize);
            ctx.strokeRect(block.x, block.y, blockSize, blockSize);
        });
    }

    function startGame() {
        playerName = document.getElementById("playerName").value.trim();
        playerId = document.getElementById("playerId").value.trim();

        if (playerName === "" || playerId === "") {
            alert("Please enter your name and Q.ID!");
            return;
        }

        playerDisplay.innerText = playerName;
        playerIdDisplay.innerText = playerId;

        ws.send(JSON.stringify({
            type: "registerPlayer",
            name: playerName,
            qid: playerId
        }));

        playerEntry.style.display = "none";
        gameContainer.style.display = "block";

        drawGrid();
        startTimer();
    }

    function quitGame() {
        alert("You have exited the game.");
        window.location.href = "about:blank";
    }

    function startTimer() {
        timer = 60;
        timerDisplay.innerText = timer;

        gameInterval = setInterval(() => {
            if (timer > 0) {
                timer--;
                timerDisplay.innerText = timer;
            } else {
                clearInterval(gameInterval);
                endGame();
            }
        }, 1000);
    }

    function endGame() {
        alert("Game Over! Your Score: " + score);

        ws.send(JSON.stringify({
            type: "updateScore",
            name: playerName,
            qid: playerId,
            score: score
        }));

        resetGame();
    }

    function resetGame() {
        score = 0;
        placedBlocks = [];
        timer = 60;
        gameContainer.style.display = "none";
        playerEntry.style.display = "block";
        drawGrid();
    }

    function isOccupied(x, y) {
        return placedBlocks.some(block => block.x === x && block.y === y);
    }

    function placeBlock(shape, x, y) {
        if (!isOccupied(x, y)) {
            placedBlocks.push({ shape, x, y });
            placeSound.play();
            score += 10;
            scoreDisplay.innerText = score;
            drawGrid();
            checkForCompletedLines();
        } else {
            alert("Position occupied! Try another spot.");
        }
    }

    function checkForCompletedLines() {
        let rowCount = Array(gridSize).fill(0);
        let colCount = Array(gridSize).fill(0);

        placedBlocks.forEach(block => {
            let rowIndex = block.y / blockSize;
            let colIndex = block.x / blockSize;
            rowCount[rowIndex]++;
            colCount[colIndex]++;
        });

        let fullRows = rowCount.map((count, index) => (count === gridSize ? index : -1)).filter(i => i !== -1);
        let fullCols = colCount.map((count, index) => (count === gridSize ? index : -1)).filter(i => i !== -1);

        if (fullRows.length > 0 || fullCols.length > 0) {
            blastBlocks(fullRows, fullCols);
        }
    }

    function blastBlocks(rows, cols) {
        blastSound.play();

        placedBlocks = placedBlocks.filter(block => {
            let rowIndex = block.y / blockSize;
            let colIndex = block.x / blockSize;
            return !rows.includes(rowIndex) && !cols.includes(colIndex);
        });

        let removedBlockCount = (rows.length + cols.length) * gridSize;
        score = Math.max(0, score - removedBlockCount * 5);
        scoreDisplay.innerText = score;

        drawGrid();
    }

    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);

        if (data.type === "leaderboardUpdate") {
            updateLeaderboard(data.leaderboard);
        }
    };

    function updateLeaderboard(newData) {
        let previousLeaderboard = [...leaderboardData];
        leaderboardData = newData;

        leaderboardList.innerHTML = "";

        leaderboardData.forEach((player, index) => {
            let previousIndex = previousLeaderboard.findIndex(p => p.qid === player.qid);
            let isPositionChanged = previousIndex !== index && previousIndex !== -1;

            let listItem = document.createElement("li");
            listItem.innerHTML = `#${index + 1} <strong>${player.name}</strong> - ${player.score}`;
            listItem.className = "transition-all ease-in-out duration-500 p-2";

            if (isPositionChanged) {
                listItem.classList.add("bg-yellow-500", "text-black", "rounded", "font-bold");
                setTimeout(() => {
                    listItem.classList.remove("bg-yellow-500", "text-black", "font-bold");
                }, 3000);
            }

            leaderboardList.appendChild(listItem);
        });
    }

    const blocks = document.querySelectorAll(".block");

    blocks.forEach(block => {
        block.addEventListener("dragstart", function (e) {
            e.dataTransfer.setData("shape", block.dataset.shape);
        });
    });

    gameCanvas.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    gameCanvas.addEventListener("drop", function (e) {
        e.preventDefault();
        const shape = e.dataTransfer.getData("shape");
        const rect = gameCanvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / blockSize) * blockSize;
        const y = Math.floor((e.clientY - rect.top) / blockSize) * blockSize;

        placeBlock(shape, x, y);
    });

    startButton.addEventListener("click", startGame);
    quitButton.addEventListener("click", quitGame);
});
