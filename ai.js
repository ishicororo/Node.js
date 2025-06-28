const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [
  { role: 'system', content: 'あなたは親切なアシスタントです。' }
];

function chat() {
  rl.question('あなた: ', async (input) => {
    messages.push({ role: 'user', content: input });

    const res = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: 'llama3', // LocalAI or LM Studioのモデル名
      messages: messages
    }, {
      headers: { Authorization: 'Bearer dummy' }
    });

    const reply = res.data.choices[0].message.content;
    console.log('Bot:', reply);
    messages.push({ role: 'assistant', content: reply });

    if (input === 'さようなら') rl.close();
    else chat();
  });
}

chat();