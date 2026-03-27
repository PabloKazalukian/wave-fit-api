const axios = require('axios');

async function testFullFlow() {
  const url = 'http://localhost:3000/graphql';
  const credentials = {
    identifier: 'asd@123.com',
    password: 'asd123'
  };

  try {
    console.log('--- Step 1: Login ---');
    const loginRes = await axios.post(url, {
      query: `
        mutation Login($identifier: String!, $password: String!) {
          login(identifier: $identifier, password: $password)
        }
      `,
      variables: credentials
    });

    console.log('Login Response:', JSON.stringify(loginRes.data, null, 2));
    const cookies = loginRes.headers['set-cookie'];
    console.log('Cookies received:', cookies ? 'YES' : 'NO');

    if (!loginRes.data.data?.login) {
      console.error('Login failed');
      return;
    }

    console.log('\n--- Step 2: Me Query ---');
    // Extract token from cookie (simplified for testing)
    const cookieHeader = cookies.join('; ');
    
    const meRes = await axios.post(url, {
      query: `
        query Me {
          me {
            id
            name
            email
            role
          }
        }
      `
    }, {
      headers: {
        Cookie: cookieHeader
      }
    });

    console.log('Me Response:', JSON.stringify(meRes.data, null, 2));

  } catch (err) {
    if (err.response) {
      console.error('Error Response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
  }
}

testFullFlow();
