const uploadForm = document.getElementById('uploadForm');
uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Get form data
    const formData = {
        title: document.getElementById('title').value,
        thumbnail: document.getElementById('thumbnail').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        video: document.getElementById('video').value
    };

    try {
        // Send data to the server
        const response = await axios.post('/upload', formData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Show success message
        if (response.status === 200) {
            Swal.fire({
                icon: 'success',
                title: 'Video Uploaded',
                text: 'Your video has been successfully uploaded!'
            });
        }
    } catch (error) {
        // Show error message
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'There was an error uploading your video.'
        });
    }
});
