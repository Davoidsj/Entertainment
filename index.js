const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = 6300;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "static")));

// Ensure "uploads" directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// PostgreSQL connection setup
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:gdilbY9FKae1@ep-royal-bonus-a5fu9rj8.us-east-2.aws.neon.tech/neondb?sslmode=require",
});

// Vimeo Access Token
const vimeoAccessToken = "c0f3e77150c4ff9dfc236961713a29c5";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueSuffix);
  },
});
const upload = multer({ storage });

// POST: Upload video data
app.post(
  "/upload",
  upload.fields([{ name: "video" }, { name: "thumbnail" }]),
  async (req, res) => {
    const { title, description, category } = req.body;

    if (!title || !req.files.thumbnail || !description || !category || !req.files.video) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const videoID = uuidv4();
    const videoPath = req.files.video[0].path;
    const thumbnailPath = req.files.thumbnail[0].path;

    try {
      // Upload thumbnail to ImgBB
      const imgbbApiKey = "8770de77dd83b4c6a2cfd923686a7700";
      const thumbnailStream = fs.createReadStream(thumbnailPath);

      const imgbbResponse = await axios.post(
        "https://api.imgbb.com/1/upload",
        new URLSearchParams({
          key: imgbbApiKey,
          image: fs.readFileSync(thumbnailPath, { encoding: "base64" }),
        })
      );

      const thumbnailUrl = imgbbResponse.data.data.url;

      // Get video file size
      const fileStats = fs.statSync(videoPath);
      const fileSize = fileStats.size;

      // Create Vimeo upload link
      const uploadUrlResponse = await axios.post(
        "https://api.vimeo.com/me/videos",
        {
          upload: {
            approach: "tus",
            size: fileSize,
          },
          name: title,
          description: description,
          tags: [category],
        },
        {
          headers: {
            Authorization: `Bearer ${vimeoAccessToken}`,
          },
        }
      );

      const uploadLink = uploadUrlResponse.data.upload.upload_link;

      // Upload video file to Vimeo
      const fileStream = fs.createReadStream(videoPath);
      await axios.patch(uploadLink, fileStream, {
        headers: {
          "Content-Type": "application/offset+octet-stream",
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": 0,
          "Content-Length": fileSize,
        },
      });

      const videoLink = `https://vimeo.com/${uploadUrlResponse.data.uri.split("/")[2]}`;

      // Insert data into the database
      await pool.query(
        "INSERT INTO entertainment_db (id, name, description, thumbnail, videolink, category) VALUES ($1, $2, $3, $4, $5, $6)",
        [videoID, title, description, thumbnailUrl, videoLink, category]
      );

      res.status(200).json({
        message: "Video uploaded successfully!",
        data: { id: videoID, title, thumbnail: thumbnailUrl, description, category, video: videoLink },
      });

      // Cleanup
      fs.unlinkSync(videoPath);
      fs.unlinkSync(thumbnailPath);
    } catch (err) {
      console.error("Error uploading video:", err);

      // Cleanup
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }

      res.status(500).json({ error: "Failed to upload video or insert data into database." });
    }
  }
);
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});
app.get('/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, thumbnail, videolink, category FROM entertainment_db');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to query database:', err);
    res.status(500).json({ error: 'Failed to query database' });
  }
})
app.get('/videos/:id', async (req, res) => {
  const videoID = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, name, description, thumbnail, videolink, category FROM entertainment_db WHERE id = $1',
      [videoID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to query database:', err);
    res.status(500).json({ error: 'Failed to query database' });
  }
});
app.get('/youtube', (_, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'youtube.html'));
});
app.post('/uploadurl', async (req, res) => {
  const { title, category, videolink } = req.body;
  if (!title ||  !category || !videolink) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const videoID = uuidv4();
  try {
    await pool.query(
      'INSERT INTO youtube_db (id, name, category, youtubeurl) VALUES ($1, $2, $3, $4)',
      [videoID, title, category,videolink]
    );
    res.status(200).json({ message: 'Video uploaded successfully!', data: { id: videoID, title, category, videolink } });
  } catch (err) {
    console.error('Database insertion failed:', err);
    res.status(500).json({ error: 'Failed to insert data into database' });
  }
});
app.get('/youtube-videos', async (_, res) => {
  try {
    const result = await pool.query('SELECT id, name, category,youtubeurl FROM youtube_db');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to query database:', err);
    res.status(500).json({ error: 'Failed to query database' });
  }
});
app.get('/youtube-videos/:id', async (req, res) => {
  const videoID = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, name, category,youtubeurl FROM youtube_db WHERE id = $1',
      [videoID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to query database:', err);
    res.status(500).json({ error: 'Failed to query database' });
  }
});

app.get("/notification", async (req, res) => {
  try {
    // Fetch the latest three videos from youtube_db
    const result = await pool.query(
      "SELECT name, category FROM youtube_db ORDER BY id DESC LIMIT 3"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: [] });
    }

    // Generate message array based on categories
    const recommendations = result.rows.map(
      (video) => `Watch ${video.name} (${video.category})`
    );

    res.status(200).json({ message: recommendations }); 
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});




// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
