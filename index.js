const express = require("express");
const app = express();
const axios = require("axios");

const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "credentials/.env") });

const uri = process.env.MONGO_CONNECTION_STRING;
const db = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let accessToken = "temp";
const authOptions = {
	url: "https://accounts.spotify.com/api/token",
	headers: {
		Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
	},
	form: {
		grant_type: "client_credentials",
	},
};

app.use(bodyParser.urlencoded({ extended: false }));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.get("/", (request, response) => {
	response.render("index");
});

app.post("/processIndex", async (request, response) => {
	try {
		const { data } = await axios.post(authOptions.url, null, {
			headers: authOptions.headers,
			params: authOptions.form,
		});
		accessToken = data.access_token;
		response.render("processIndex");
	} catch (error) {
		console.error("Failed to obtain access token:", error);
		response.status(500).send("Failed to obtain access token");
	}
});

app.get("/addSong", (request, response) => {
	response.render("addSong");
});

app.post("/processAddSong", async (request, response) => {
	const { songID } = request.body;

	const res = await fetch(`https://api.spotify.com/v1/tracks/${songID}`, {
		method: "GET",
		headers: {
			Authorization: "Bearer " + accessToken,
		},
	});

	const songInfoJson = await res.json();
	const songName = songInfoJson.name;
	const albumName = songInfoJson.album.name;
	let artistNames = "";
	const artists = songInfoJson.artists;
	for (let i = 0; i < artists.length; i++) {
		artistNames += artists[i].name;
		if (i !== artists.length - 1) {
			artistNames += ", ";
		}
	}
	const releaseDate = songInfoJson.album.release_date;
	const popularity = songInfoJson.popularity;

	const songInfo = {
		songName: songName,
		albumName: albumName,
		artistName: artistNames,
		releaseDate: releaseDate,
		popularity: popularity,
	};

	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	try {
		await client.connect();
		await client.db(db).collection(collection).insertOne(songInfo);
		response.render("songInfo", songInfo);
	} catch (err) {
		console.error(err);
	} finally {
		await client.close();
	}
});

app.get("/viewPlaylist", (request, response) => {
	response.render("viewPlaylist");
});

app.post("/processViewPlaylist", async (request, response) => {
	const style = `style="border: 1px double"`;
	let playlistTable = `<table ${style}><tr><th ${style}>Song Name</th><th ${style}>Album Name</th>`;
	playlistTable += `<th ${style}>Artist Names</th><th ${style}>Release Date</th><th ${style}>Popularity</th></tr>`;

	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	try {
		await client.connect();
		const playlistSongs = await client.db(db).collection(collection).find({}).toArray();
		playlistSongs.forEach((song) => {
			playlistTable += `<tr><td ${style}>${song.songName}</td>`;
			playlistTable += `<td ${style}>${song.albumName}</td>`;
			playlistTable += `<td ${style}>${song.artistName}</td>`;

			playlistTable += `<td ${style}>${song.releaseDate}</td>`;
			playlistTable += `<td ${style}>${song.popularity}</td></tr>`;
		});
		response.render("processViewPlaylist", { table: playlistTable + `</table>` });
	} catch (err) {
		console.error(err);
	} finally {
		await client.close();
	}
});

app.get("/clearPlaylist", (request, response) => {
	response.render("clearPlaylist");
});

app.post("/processClearPlaylist", async (request, response) => {
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	try {
		await client.connect();
		const result = await client.db(db).collection(collection).deleteMany({});
		response.render("processClearPlaylist", { count: result.deletedCount });
	} catch (err) {
		console.error(err);
	} finally {
		await client.close();
	}
});

app.get("/searchSong", (request, response) => {
	response.render("searchSong");
});

app.post("/processSearchSong", async (request, response) => {
	const { songID } = request.body;

	const res = await fetch(`https://api.spotify.com/v1/tracks/${songID}`, {
		method: "GET",
		headers: {
			Authorization: "Bearer " + accessToken,
		},
	});

	const songInfoJson = await res.json();
	const songName = songInfoJson.name;
	const albumName = songInfoJson.album.name;
	let artistNames = "";
	const artists = songInfoJson.artists;
	for (let i = 0; i < artists.length; i++) {
		artistNames += artists[i].name;
		if (i !== artists.length - 1) {
			artistNames += ", ";
		}
	}
	const releaseDate = songInfoJson.album.release_date;
	const popularity = songInfoJson.popularity;

	const songInfo = {
		songName: songName,
		albumName: albumName,
		artistName: artistNames,
		releaseDate: releaseDate,
		popularity: popularity,
	};

	response.render("songInfo", songInfo);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

process.stdin.setEncoding("utf8");

if (process.argv.length != 2) {
	process.stdout.write("Usage index.js");
	process.exit(1);
}

const portNumber = 5001;
app.listen(portNumber);

console.log("Web server started and running at http://localhost:" + portNumber);
process.stdout.write("Stop to shutdown the server: ");

process.stdin.on("readable", function () {
	const dataInput = process.stdin.read();
	if (dataInput !== null) {
		const command = dataInput.trim();
		if (command === "stop") {
			console.log("Shutting down the server");
			process.exit(0);
		}
	}
});
