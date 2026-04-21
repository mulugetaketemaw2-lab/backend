const axios = require('axios');

async function verifyToggle() {
    const baseURL = 'http://localhost:5001/api';
    console.log(`Verifying API at ${baseURL}...`);

    try {
        // 1. Login as admin
        const loginRes = await axios.post(`${baseURL}/auth/login`, {
            username: 'mule',
            password: '1234',
            roleType: 'Admin'
        });
        const token = loginRes.data.token;
        console.log('✅ Logged in as admin');

        // 2. Fetch users to find a suspended one or any executive
        const usersRes = await axios.get(`${baseURL}/auth/users?showAll=true`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = usersRes.data;
        const target = users.find(u => u.email === 'tmh') || users[0];
        
        if (!target) {
            console.log('⚠️ No users found to test toggle.');
            return;
        }

        console.log(`🔄 Toggling status for: ${target.name} (Current isActive: ${target.isActive !== false})`);

        // 3. Perform PATCH toggle
        const newStatus = target.isActive === false; // If suspended (false), set to true
        const toggleRes = await axios.patch(`${baseURL}/auth/user/${target._id}/status`, 
            { isActive: newStatus }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('✅ Toggle Response:', toggleRes.data.message);
        console.log(`✅ New Status: ${toggleRes.data.user.isActive}`);

        // 4. Toggle back for safety if desired, but here we just prove it works
        console.log('🚀 Verification Complete!');

    } catch (error) {
        console.error('❌ Verification Failed:', error.response?.data || error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Ensure the server is running on port 5001.');
        }
    }
}

verifyToggle();
