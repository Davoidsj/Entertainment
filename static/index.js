$('#uploadForm').on('submit', async (event) => {
    event.preventDefault();
  
    // Prepare FormData
    const formData = new FormData();
    formData.append('title', $('#title').val());
    formData.append('thumbnail', $('#thumbnail').val());
    formData.append('description', $('#description').val());
    formData.append('category', $('#category').val());
    formData.append('video', $('#video')[0].files[0]); // Include the video file
  
    try {
      // Send the form data to the server
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // Required for file uploads
        },
      });
  
      // Show success message
      if (response.status === 200) {
        Swal.fire({
          icon: 'success',
          title: 'Video Uploaded',
          text: 'Your video has been successfully uploaded!',
        });
  
        // Optionally, reset the form
        $('#uploadForm')[0].reset();
      }
    } catch (error) {
      console.error('Error uploading video:', error);
  
      // Show error message
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'There was an error uploading your video. Please try again.',
      });
    }
  });
  