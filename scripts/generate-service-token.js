const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'stats-lambda', role: 'SERVICE' },
  'SECRETO', // El valor de JWT_SECRET en tu .env
  { expiresIn: '100y' } // Que no expire pronto
);

console.log('Tu STATS_SERVICE_JWT es:');
console.log(token);