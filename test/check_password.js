const bcrypt = require('bcryptjs');

const hash = '$2b$10$p90IPYitluyqbatl58iWEulN6KxUHbIhDGsEnvXQw.VzrcYrt0U/G';
const password = 'asd123';

bcrypt.compare(password, hash).then(res => {
    console.log('Password match:', res);
}).catch(err => {
    console.error('Error:', err);
});
