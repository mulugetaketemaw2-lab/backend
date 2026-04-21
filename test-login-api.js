const axios = require('axios');

const testLogin = async () => {
  try {
    console.log("Testing login for mule1...");
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      username: 'mule1',
      password: '1234'
    });
    console.log("Login Success:", response.data.message);
    console.log("Token received:", response.data.token ? "Yes" : "No");
  } catch (error) {
    console.log("Login Failed!");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Message:", error.response.data.message);
    } else {
      console.log("Error:", error.message);
    }
  }
};

testLogin();
