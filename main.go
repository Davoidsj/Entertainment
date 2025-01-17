package main

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Struct to map video data
type Video struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Thumbnail   string `json:"thumbnail"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Video       string `json:"video"`
}

func main() {
	// Connect to the PostgreSQL database
	conn, err := pgx.Connect(context.Background(), "postgresql://neondb_owner:gdilbY9FKae1@ep-royal-bonus-a5fu9rj8.us-east-2.aws.neon.tech/neondb?sslmode=require")
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer conn.Close(context.Background())

	r := gin.Default()

	// Enable CORS for all origins
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // Allow all origins
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Serve static files (like index.js)
	r.Static("/static", "./static")

	// Handle POST request to upload video data
	r.POST("/upload", func(c *gin.Context) {
		var videoData Video

		// Parse JSON request body
		if err := c.ShouldBindJSON(&videoData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Generate a new UUID for the video
		videoID := uuid.New().String()

		// Insert data into PostgreSQL
		_, err := conn.Exec(context.Background(),
			"INSERT INTO entertainment_db (id, name, description, thumbnail, videolink, category) VALUES ($1, $2, $3, $4, $5, $6)",
			videoID, videoData.Title, videoData.Description, videoData.Thumbnail, videoData.Video, videoData.Category)
		if err != nil {
			log.Printf("Database insertion failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert data into database"})
			return
		}

		// Respond with success
		c.JSON(http.StatusOK, gin.H{
			"message": "Video uploaded successfully!",
			"data":    videoData,
		})
	})

	// Handle GET request to fetch video data
	r.GET("/videos", func(c *gin.Context) {
		rows, err := conn.Query(context.Background(), "SELECT id, name, description, thumbnail, videolink, category FROM entertainment_db")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query database"})
			return
		}
		defer rows.Close()

		var videos []Video
		for rows.Next() {
			var video Video
			err := rows.Scan(&video.ID, &video.Title, &video.Description, &video.Thumbnail, &video.Video, &video.Category)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan row"})
				return
			}
			videos = append(videos, video)
		}

		if rows.Err() != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating over rows"})
			return
		}

		// Respond with the array of video objects
		c.JSON(http.StatusOK, videos)
	})
 
	// Handle GET request to fetch a video by ID
   r.GET("/videos/:id", func(c *gin.Context) {
    videoID := c.Param("id") // Get the ID from the URL path

    var video Video
    err := conn.QueryRow( 
        context.Background(),
        "SELECT id, name, description, thumbnail, videolink, category FROM entertainment_db WHERE id=$1",
        videoID,
    ).Scan(&video.ID, &video.Title, &video.Description, &video.Thumbnail, &video.Video, &video.Category)

    if err != nil {
        if err == pgx.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query database"})
        }
        return
    }

    // Respond with the video object
    c.JSON(http.StatusOK, video)
      })
 
 

	// Serve the HTML page
	r.LoadHTMLGlob("templates/*")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	// Start the server
	r.Run(":8080")
}
