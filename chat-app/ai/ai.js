const axios = require('axios');

const API_KEY = 'AIzaSyABjHASxQqBTbpea6WlI_6rVyACls4ZTK4'; // ← 自分のAPIキーに差し替えてください
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

const requestBody = {
  contents: [
    {
      parts: [
        { text: "Explain how AI works in a few words" }
      ]
    }
  ]
};

axios.post(`${URL}?key=${API_KEY}`, requestBody, {
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => {
  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("💬 AIの応答:", text);
})
.catch(error => {
  console.error("❌ エラー:", error.response?.data || error.message);
});