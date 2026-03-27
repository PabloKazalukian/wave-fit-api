const axios = require('axios');

const query = `
  mutation Login($identifier: String!, $password: String!) {
    login(identifier: $identifier, password: $password)
  }
`;

const variables = {
  identifier: 'asd@123.com',
  password: 'asd123'
};

axios.post('http://localhost:3000/graphql', {
  query,
  variables
})
.then(res => {
  console.log('Response:', JSON.stringify(res.data, null, 2));
  console.log('Headers:', res.headers['set-cookie']);
})
.catch(err => {
  if (err.response) {
    console.log('Error Response:', JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('Error:', err.message);
  }
});
