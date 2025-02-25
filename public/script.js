document.addEventListener("DOMContentLoaded", function () {
    const ws = new WebSocket("wss://block-blaster.onrender.com"); // WebSocket Connection

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
    let gameActive = false; // Track if the game is active

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
            ctx.fillStyle = "#FFD700"; // Block color
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
        gameActive = true; // Set game active when starting
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
        gameActive = false; // Set game inactive when ending
        alert("Game Over! Your Score: " + score);

        // Send score update to server
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

    function generateRandomPoints() {
        return Math.floor(Math.random() * 20) + 1; // Random points between 1 and 20
    }

    function placeBlock(shape, x, y) {
        if (!isOccupied(x, y) && gameActive) { // Only allow placing blocks if the game is active
            placedBlocks.push({ shape, x, y });
            placeSound.play();
            const randomPoints = generateRandomPoints();
            score += randomPoints; // Increase score with random points
            scoreDisplay.innerText = score;
            drawGrid();
            checkForCompletedLines();
        } else if (!gameActive) {
            alert("Time is up! Cannot place more blocks.");
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

    // WebSocket message handling
    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);

        if (data.type === "leaderboard") {
            updateLeaderboard(data.leaderboard); // Update leaderboard function
        }
    };

    function updateLeaderboard(newData) {
        leaderboardList.innerHTML = ""; // Clear previous entries

        newData.forEach((player, index) => {
            const row = document.createElement("tr");
            row.className = "leaderboard-row"; // Add class for animation

            // Create cells for position, name, and score
            const positionCell = document.createElement("td");
            positionCell.className = "py-2 px-4"; // Styling for position cell
            positionCell.textContent = player.position;

            const nameCell = document.createElement("td");
            nameCell.className = "py-2 px-4"; // Styling for name cell
            nameCell.innerHTML = `<strong>${player.name}</strong>`;

            const scoreCell = document.createElement("td");
            scoreCell.className = "py-2 px-4"; // Styling for score cell
            scoreCell.textContent = player.score;

            // Append cells to the row
            row.appendChild(positionCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);

            // Append row to the leaderboard table body
            leaderboardList.appendChild(row);

            // Trigger the animation
            setTimeout(() => {
                row.classList.add("visible");
            }, 50 * index); // Use a timeout to ensure the row is in the DOM before adding the class
        });
    }

    const blocks = document.querySelectorAll(".block");

    blocks.forEach(block => {
        block.addEventListener("dragstart", function (e) {
            e.dataTransfer.setData("shape", block.dataset.shape);
        });

        // Add touch event listeners for mobile support
        block.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Prevent default touch behavior
            const touch = e.touches[0];
            const event = new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.dispatchEvent(event);
        });

        block.addEventListener('touchmove', function(e) {
            e.preventDefault(); // Prevent default touch behavior
            const touch = e.touches[0];
            const event = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.dispatchEvent(event);
        });

        block.addEventListener('touchend', function(e) {
            e.preventDefault(); // Prevent default touch behavior
            const event = new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            this.dispatchEvent(event);
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

    // Add touch event listeners for mobile support on the canvas
    gameCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault(); // Prevent default touch behavior
        const touch = e.touches[0];
        const event = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        gameCanvas.dispatchEvent(event);
    });

    gameCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault(); // Prevent default touch behavior
        const touch = e.touches[0];
        const event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        gameCanvas.dispatchEvent(event);
    });

    gameCanvas.addEventListener('touchend', function(e) {
        e.preventDefault(); // Prevent default touch behavior
        const event = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        gameCanvas.dispatchEvent(event);
    });

    startButton.addEventListener("click", startGame);
    quitButton.addEventListener("click", quitGame);
});