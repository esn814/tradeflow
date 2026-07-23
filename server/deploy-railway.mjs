import { randomBytes } from 'crypto';

const TOKEN = '7608beaa-d874-43b2-a183-a6e3b638fa42';
const PROJECT_ID = '8ebf8990-8986-465a-89a0-a8fd729e4b64';
const ENV_ID = 'b502728c-043e-443a-add7-8ae82dd01b2a';
const SERVICE_ID = '1a6eb5ce-89cd-4a6b-84ac-acf7f408b3c9';

const jwtSecret = randomBytes(32).toString('hex');

async function gql(query, variables) {
  const r = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
  }
  return json;
}

// Step 1: Set environment variables
console.log('\n=== Setting environment variables ===');
const vars = {
  NODE_ENV: 'production',
  JWT_SECRET: jwtSecret,
  CORS_ORIGINS: 'https://tradeflow.cloud.hyperpaxeer.com',
  DB_PATH: '/app/data/tradeflow.db'
};

for (const [key, value] of Object.entries(vars)) {
  const result = await gql(
    `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
    {
      input: {
        projectId: PROJECT_ID,
        environmentId: ENV_ID,
        serviceId: SERVICE_ID,
        name: key,
        value: value
      }
    }
  );
  console.log(`  ${key}: ${result.data ? 'OK' : 'FAILED'}`);
}

// Step 2: Introspect ServiceInstance to understand deploy config
console.log('\n=== Introspecting deploy-related types ===');
const typeResult = await gql(`{ __type(name: "ServiceInstance") { fields { name type { name kind ofType { name } } } } }`);
if (typeResult.data?.__type?.fields) {
  const fields = typeResult.data.__type.fields.map(f => f.name);
  console.log('ServiceInstance fields:', fields.join(', '));
}

// Step 3: Try to list existing service instances to see structure
console.log('\n=== Listing service instances ===');
const instancesResult = await gql(
  `query($projectId: String!, $environmentId: String!) { serviceInstances(projectId: $projectId, environmentId: $environmentId) { edges { node { id serviceId environmentId source { repo branch } } } } }`,
  { projectId: PROJECT_ID, environmentId: ENV_ID }
);
console.log(JSON.stringify(instancesResult, null, 2));

console.log('\n=== JWT_SECRET (save this) ===');
console.log(jwtSecret);
