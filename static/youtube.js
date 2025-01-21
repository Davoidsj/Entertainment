

$('#uploadFormForYouTube').on('submit', async event => {
    event.preventDefault();

    // Get form data
    const formData = {
        title: $('#name').val(),
        category: $('#category').val(),
        videolink: $('#youtubeurl').val()
    };

 

    try {
        // Send data to the server
        const response = await axios.post('/uploadurl', formData, {
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
