async function testToggle() {
  try {
    const port = 5001;
    console.log(`Testing on port ${port}...`);
    // 1. Log in as admin
    const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mule', password: '1234' })
    });
    
    if(!loginRes.ok) {
      console.error("Login failed:", loginRes.status, await loginRes.text());
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("Logged in successfully!", loginData.user.name);

    // 2. Fetch all suspended users
    const usersRes = await fetch(`http://localhost:${port}/api/auth/users?showAll=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const usersData = await usersRes.json();
    const suspendedUsers = usersData.filter(u => u.isActive === false);
    if(suspendedUsers.length === 0) {
      console.log("No suspended users found.");
      return;
    }
    
    // Choose specific user 'tmh' (ኢያሱ)
    const userToToggle = suspendedUsers.find(u => u.email === 'tmh') || suspendedUsers[0];
    console.log(`Trying to toggle user: ${userToToggle.name} (${userToToggle.role})`);

    // 3. Try to toggle
    const toggleRes = await fetch(`http://localhost:${port}/api/auth/user/${userToToggle._id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ isActive: true })
    });
    
    if(!toggleRes.ok) {
      console.error("API Error Response:", toggleRes.status, await toggleRes.text());
    } else {
      console.log("Toggle successful:", await toggleRes.json());
    }
    
  } catch(e) {
    console.error("Fetch Error:", e.message);
  }
}

testToggle();
