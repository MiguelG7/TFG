const express = require('express');
const session = require('express-session');
const app = express();
const cookieParser = require('cookie-parser');
require('dotenv').config();

//sockets
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));//hace que public sea el comienzo de la ruta relativa haciendo posible rutas como /javascript/snake en snake.ejs
app.set('view engine','ejs');
app.set('views','./views');


app.locals.title = process.env.TITLE_ENV;

app.use(express.urlencoded({ extended: true }));//hace que se pueda usar req.body
app.use(express.json());//hace que se pueda usar req.body

const indexRouter = require('./routes/index');
const chischasRouter = require('./routes/chischas');
const registroRouter = require('./routes/registro');

app.use(session({
    secret: 'mi-secreto',
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60 * 24}
}));

app.use(cookieParser());

app.use((req, res, next) => {
    res.locals.session = req.session; // Hacer que la sesión esté disponible en las vistas
    res.locals.cookiesAccepted = req.cookiesAccepted || false;
    console.log(`${req.method} request for ${req.url}`);
    next();
});

app.use('/', indexRouter);
app.use('/chischas', chischasRouter);
app.use('/registro', registroRouter);

io.on("connection", (socket) => {
  console.log("Un jugador se ha conectado.");

  socket.on("joinGame", (gameId) => {
      socket.join(gameId);
      console.log(`Jugador unido a la partida ${gameId}`);
      socket.emit("gameJoined", `Te has unido a la partida ${gameId}`);
  });

  socket.on("disconnect", () => {
      console.log("Un jugador se ha desconectado.");
  });
});

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}, access: http://localhost:${port}`);  
});
