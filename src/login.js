document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await axios.post(
        "http://localhost:5000/api/user/login",
        {
          email,
          password,
        }
      );

      // Assuming the backend returns a JWT token
      const data = response.data;

      // Store the token using ipcRenderer
      window.electronAPI.sendToken(data); // Send the token to the main process for storage
      window.location.href = "index.html"; // Load the main application after successful login
    } catch (err) {
      console.error("Login error:", err); // Log detailed error information
      if (err.response && err.response.data && err.response.data.message) {
        console.log("Error message:", err.response.data.message);
      } else {
        console.log("An unexpected error occurred");
      }
    }
  });
