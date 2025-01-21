const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const multer = require('multer');
const axios = require('axios'); // For making HTTP requests to Vimeo API
const fs = require('fs'); // To ensure directories exist

const app = express();
const PORT = 6300;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request body
app.use('/static', express.static(path.join(__dirname, 'static'))); // Serve static files

// Ensure "uploads" directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// PostgreSQL connection setup
const pool = new Pool({
  connectionString:
    'postgresql://neondb_owner:gdilbY9FKae1@ep-royal-bonus-a5fu9rj8.us-east-2.aws.neon.tech/neondb?sslmode=require',
});

// Vimeo Access Token
const vimeoAccessToken = 'c0f3e77150c4ff9dfc236961713a29c5'; 
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory to save uploaded files
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueSuffix); // Save file with a unique name
  },
});
const upload = multer({ storage });

// POST: Upload video data


app.post('/upload', upload.single('video'), async (req, res) => {
  const { title, thumbnail, description, category } = req.body;

  // Ensure required fields are provided
  if (!title || !thumbnail || !description || !category || !req.file) {
    return res.status(400).json({ error: 'All fields are required, including a video file.' });
  }

  const videoID = uuidv4();
  const videoPath = req.file.path; // Path to the uploaded video file

  try {
    // Step 1: Read the file
    const fileStats = fs.statSync(videoPath); // Get file stats for size
    const fileSize = fileStats.size; // Get file size in bytes

    // Step 2: Create a Vimeo upload link
    const uploadUrlResponse = await axios.post(
      'https://api.vimeo.com/me/videos',
      {
        upload: {
          approach: 'tus',
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

    // Step 3: Upload the file to Vimeo using the TUS protocol
    const fileStream = fs.createReadStream(videoPath); // Create a readable stream of the file
    await axios.patch(uploadLink, fileStream, {
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': 0,
        'Content-Length': fileSize,
      },
    });
    console.log(uploadUrlResponse.data.uri);

    const videoLink = `https://vimeo.com/${uploadUrlResponse.data.uri.split('/')[2]}`; // Get the video link

    // Step 4: Insert data into the database
    await pool.query(
      'INSERT INTO entertainment_db (id, name, description, thumbnail, videolink, category) VALUES ($1, $2, $3, $4, $5, $6)',
      [videoID, title, description, thumbnail, videoLink, category]
    );

    res.status(200).json({
      message: 'Video uploaded successfully!',
      data: { id: videoID, title, thumbnail, description, category, video: videoLink },
    });

    // Step 5: Optional cleanup - delete the file after uploading to Vimeo
    fs.unlinkSync(videoPath);
  } catch (err) {
    console.error('Error uploading video:', err.message);

    // Cleanup on failure
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath); // Remove the file if an error occurs
    }

    res.status(500).json({ error: 'Failed to upload video or insert data into database.' });
  }
});


// GET: Fetch all videos
app.get('/videos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, thumbnail, videolink, category FROM entertainment_db'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to query database:', err.message);
    res.status(500).json({ error: 'Failed to query database' });
  }
});

// GET: Fetch a video by ID
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
    console.error('Failed to query database:', err.message);
    res.status(500).json({ error: 'Failed to query database' });
  }
});

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});
app.get('/youtube',(_,res)=>{
  res.sendFile(path.join(__dirname, 'templates', 'youtube.html'));
})
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

// GET: Fetch a video by ID
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
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
