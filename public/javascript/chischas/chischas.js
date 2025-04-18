import { Chess } from '/chessjs/dist/esm/chess.js';

const socket = io(); // Inicializa el cliente de Socket.IO
let playerColor = null; // Color del jugador
let chess = null; // Instancia de Chess.js
let board = null; // Instancia de ChessBoard.js
let gameId = null; // ID de la partida

socket.on("connect", () => {
    console.log("Conectado al servidor de Socket.IO con ID:", socket.id);
});

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const userName = body.dataset.userName;
    const userId = body.dataset.userId;
    const startGameButton = document.getElementById('startGameButton');

    // Lógica para el botón de iniciar partida
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            if (userId) {
                // Usuario logueado, usa su nombre
                socket.emit('joinGame', { gameId, playerName: userName });
            } else {
                // Usuario no logueado, solicita el nombre
                const playerName = prompt('Introduce tu nombre para jugar:');
                if (playerName) {
                    socket.emit('joinGame', { gameId, playerName });
                }
            }
        });
    }

    // Lógica para la partida
    if (document.getElementById('board1')) {
        gameId = window.location.pathname.split('/').pop(); // Obtiene el ID de la partida desde la URL

        // Unirse a la partida
        if (userId) {
            socket.emit("joinGame", { gameId, userId, userName });
        } else {
            let playerName = null;
            while (!playerName) {
                playerName = prompt('Introduce tu nombre para jugar:');
                if (!playerName) {
                    alert('El nombre no puede estar vacío. Por favor, introduce un nombre.');
                }
            }
            socket.emit("joinGame", { gameId, playerName });
        }

        // Mostrar animación de espera
        const colorSortingModal = document.getElementById('color-sorting-modal');
        colorSortingModal.classList.remove('hidden');

        // Mostrar mensajes en un modal con promesa para encadenar animaciones
        const showMessage = (message, duration = 3000) => {
            return new Promise((resolve) => {
                const messageModal = document.getElementById('message-modal');
                const messageContent = messageModal.querySelector('.message-content');
                messageContent.textContent = message;
                messageModal.classList.remove('hidden');

                setTimeout(() => {
                    messageModal.classList.add('hidden');
                    resolve(); // Resuelve la promesa después de la duración
                }, duration);
            });
        };

        // Actualizar el estado de los jugadores y el número de jugadores
        const updateGameStatus = (playerNames, playerCount) => {
            const player1Status = document.getElementById('player1-status');
            const player2Status = document.getElementById('player2-status');
            const playerCountElement = document.getElementById('player-count');

            player1Status.textContent = `Jugador 1: ${playerNames[0] || 'Esperando...'}`;
            player2Status.textContent = `Jugador 2: ${playerNames[1] || 'Esperando...'}`;
            playerCountElement.textContent = `Número de jugadores en la partida: ${playerCount}`;
        };

        // Escuchar actualizaciones del estado del juego desde el servidor
        socket.on("updateGameStatus", ({ playerNames, playerCount }) => {
            updateGameStatus(playerNames, playerCount);
        });

        // Esperar al rival
        socket.on("waitingForOpponent", async (message) => {
            console.log(message);
            await showMessage(message); // Mostrar mensaje de espera
        });

        // Verificar si ambos jugadores han ingresado sus nombres
        socket.on("bothPlayersReady", () => {
            console.log("Ambos jugadores están listos. Sorteando colores...");
            socket.emit("startColorSorting", { gameId });

            if (game.players.length === 2) {
                console.log("Ambos jugadores están listos. Iniciando cuenta atrás...");
                io.to(gameId).emit("startCountdown");
            } else {
                socket.emit("waitingForOpponent", "Esperando a que se una el rival...");
            }
        });

        // Asignar color al jugador
        socket.on("colorAssignment", async ({ color, opponentName, opponentPicture }) => {
            console.log("Evento colorAssignment recibido:", color, opponentName);
            playerColor = color;

            // Actualiza los datos del jugador y del oponente
            if (playerColor === 'w') {
                document.getElementById('player1-name').textContent = userName || playerName;
                document.getElementById('player1-picture').src = '/uploads/white.png';
                document.getElementById('player2-name').textContent = opponentName;
                document.getElementById('player2-picture').src = opponentPicture;
            } else {
                document.getElementById('player1-name').textContent = opponentName;
                document.getElementById('player1-picture').src = opponentPicture;
                document.getElementById('player2-name').textContent = userName || playerName;
                document.getElementById('player2-picture').src = '/uploads/black.png';
            }

            // Mostrar mensaje de asignación de color
            await showMessage(`¡Color asignado! Tú juegas con las ${playerColor === 'w' ? 'blancas' : 'negras'}.`);

            // Mostrar el modal de "VS"
            const vsModal = document.getElementById('vs-modal');
            vsModal.classList.remove('hidden');
        });

        // Mostrar cuenta atrás sincronizada
        socket.on("startCountdown", () => {
            console.log("Evento startCountdown recibido");

            const vsModal = document.getElementById('vs-modal');
            const colorSortingModal = document.getElementById('color-sorting-modal');

            // Configurar el contador
            let countdown = 3; // Segundos para el conteo regresivo
            const countdownElement = document.createElement('p');
            countdownElement.id = 'countdown';
            countdownElement.style.marginTop = '20px';
            countdownElement.style.fontSize = '1.5rem';
            countdownElement.style.color = 'white';
            countdownElement.textContent = `La partida comienza en: ${countdown}`;
            vsModal.appendChild(countdownElement);

            // Iniciar el temporizador
            const interval = setInterval(() => {
                countdown -= 1;
                countdownElement.textContent = `La partida comienza en: ${countdown}`;

                if (countdown === 0) {
                    clearInterval(interval); // Detener el temporizador

                    // Eliminar el contador y ocultar los modales
                    countdownElement.remove(); // Elimina el elemento del contador
                    vsModal.classList.add('hidden'); // Oculta el modal de "VS"
                    colorSortingModal.classList.add('hidden'); // Oculta el modal de "Decidiendo tu color"

                    // Inicializar el tablero
                    chess = new Chess();
                    board = ChessBoard('board1', {
                        draggable: true,
                        position: 'start',
                        pieceTheme: '/chessboardjs/www/img/chesspieces/wikipedia/{piece}.png',
                        orientation: playerColor === 'w' ? 'white' : 'black', // Orientar el tablero según el color
                        onDrop: (source, target) => {
                            if (chess.turn() !== playerColor) {
                                return 'snapback'; // No es el turno del jugador
                            }

                            const move = chess.move({
                                from: source,
                                to: target,
                                promotion: 'q', // Promoción automática a reina
                            });

                            if (move === null) return 'snapback'; // Movimiento inválido

                            board.position(chess.fen()); // Actualiza el tablero

                            // Enviar el movimiento al oponente
                            socket.emit("move", { gameId, move });
                        },
                    });

                    // Mostrar el color asignado
                    showMessage(`¡La partida ha comenzado! Tú juegas con las ${playerColor === 'w' ? 'blancas' : 'negras'}.`);
                }
            }, 1000); // Actualizar cada segundo
        });

        // Escuchar movimientos del oponente
        socket.on("opponentMove", (move) => {
            chess.move(move); // Actualiza la lógica del juego
            board.position(chess.fen()); // Actualiza el tablero
        });

        // Manejar desconexión del oponente
        socket.on("opponentDisconnected", (message) => {
            console.log(message);
            showMessage(message);
        });

        // Escuchar el estado del juego
        socket.on("gameState", ({ fen, history, turn, playerNames }) => {
            if (fen) {
                chess = new Chess(fen); // Restaurar el estado del juego
                board.position(fen); // Actualizar el tablero
            }

            // Mostrar el historial de movimientos
            const historyElement = document.getElementById('history');
            historyElement.innerHTML = ''; // Limpiar el historial
            history.forEach(move => {
                const moveElement = document.createElement('p');
                moveElement.textContent = move;
                historyElement.appendChild(moveElement);
            });
        });

        // Manejar el envío de mensajes de chat
        const chatInput = document.getElementById('chat-input');
        const sendChatButton = document.getElementById('send-chat');
        const chatMessages = document.getElementById('chat-messages');

        sendChatButton.addEventListener('click', () => {
            const message = chatInput.value.trim();
            if (message) {
                socket.emit("chatMessage", { gameId, message, playerName: userName });
                chatInput.value = ''; // Limpiar el campo de entrada
            }
        });

        socket.on("chatMessage", ({ playerName, message }) => {
            const messageElement = document.createElement('p');
            messageElement.innerHTML = `<strong>${playerName}:</strong> ${message}`;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight; // Desplazar hacia abajo
        });

        // Actualizar el historial de movimientos
        socket.on("gameState", ({ history }) => {
            const historyElement = document.getElementById('history');
            historyElement.innerHTML = ''; // Limpiar el historial
            history.forEach((move, index) => {
                const moveElement = document.createElement('p');
                moveElement.textContent = `${index + 1}. ${move}`;
                historyElement.appendChild(moveElement);
            });
        });
    }
});
