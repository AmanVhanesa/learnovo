const axios = require('axios');

async function testLiveApi() {
    try {
        const loginRes = await axios.post('https://learnovo-backend.onrender.com/api/auth/login', {
            email: 'amanvhanesa@gmail.com',
            password: 'password123'
        });

        const token = loginRes.data.token;
        console.log("Logged in successfully. Token obtained.");

        const studentsRes = await axios.get('https://learnovo-backend.onrender.com/api/students?class=1&section=A&limit=100', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Section A Count from Live API:", studentsRes.data.data.length);
        console.log("Total pagination count:", studentsRes.data.pagination.total);
        if (studentsRes.data.data.length > 0) {
            console.log("First student in Section A:", studentsRes.data.data[0].fullName);
        }
    } catch (err) {
        console.error("Error testing live API:", err.response ? err.response.data : err.message);
    }
}

testLiveApi();
