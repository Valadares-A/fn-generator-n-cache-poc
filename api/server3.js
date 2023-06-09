// import express from 'express';
// import pkg from 'body-parser';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import axios from 'axios';
// import { randomUUID } from 'crypto'
// import {mockFields} from './mock_fields';
const express = require('express');
const pkg = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { mockFields } = require('./mock_fields');


const { json, urlencoded } = pkg;
const PORT = 3001;
const BASE_URL = "https://api.staging.base.cropwise.com/v2";
const CONNECT_URL = "https://dev-api.databus.cropwise.com/valet/v2/graphql"
const token = ""

function tokenInterceptor(config) {
  if (config.url !== '/login') {
    if (token) {
      config.headers.Authorization = `Bearer ${token.replace(/['"]+/g, '')}`;
    }
  }
  return config;
}
//TODO: implement separeted modules
axios.interceptors.request.use(tokenInterceptor)

// defining the Express app
const app = express();

// adding Helmet to enhance your Rest API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(json());
app.use(urlencoded({ extended: false }));

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.get('/', (_req, res) => {
  res.status(200).send('Hi! :)');
});

app.get('/bff/orgs', async (_req, res) => {
  try {
    const { data: { content } } = await axios.get(`${BASE_URL}/orgs`);
    const simpleContent = content.map((value) => {
      return {
        name: value.name,
        id: value.id,
        label: value.name,
        value: value.id,
        disabled: false,
      }
    })
    res.status(200).send(simpleContent);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});


app.get('/bff/farms', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) {
      return res.send('Org id not found :( ');
    }
    const { data: { content } } = await axios.get(`${BASE_URL}/orgs/${orgId}/properties`);
    const simpleContent = content.map((value) => {
      return {
        name: value.name,
        id: value.id,
        orgId: value.org_id,
        label: value.name,
        value: value.id
      }
    });
    res.status(200).send(simpleContent);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});

app.get('/bff/fields', async (req, res) => {
  try {
    const { farmId } = req.query;
    if (!farmId) {
      return res.send('Farm id not found :( ');
    }
    const { data: { content } } = await axios.get(`${BASE_URL}/properties/${farmId}/fields?attributes=geometry`);
    const simpleContent = content.map((value) => {
      return {
        name: value.name,
        farmId: value.property_id,
        id: value.id,
        area: value.calculated_area,
        centroid: value.reference_point,
        geometry: value.geometry
      }
    });
    res.status(200).send(simpleContent);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});

app.get('/bff/operations', async (req, res) => {
  try {
    const { orgId, fieldId } = req.query;
    if (!fieldId || !orgId) {
      return res.send('Farm id not found :( ');
    }

    const { data: { data: { operations: data } } } = await axios.post(`${CONNECT_URL}`, {
      query: `query GetCanonicals {
	operations(
		org_id: "${orgId}"
		fields:{id:"${fieldId}"}
	) {
		id
		start_date_time
		end_date_time
		product_uses {
			resource_ref
		}
		organization_name
		organization_ref
		farms {
			id
			description
			aliases {
				id
				model_scope
				system_type
				instance_system_id
			}
			description
			grower_ref
		}
		fields {
			id
			aliases {
				id
				model_scope
				system_type
				instance_system_id
			}
			description
			grower_ref
			farm_ref
			is_resolved
		}
		land_uses {
			resource_ref
			resource_measures {
				dtr_code
				value
				uom
				user_uom
			}
		}
		attachments {
			description
			attachment_type
			uri
		}
		aliases {
			system_type
		}
		products {
			id
			aliases {
				id
				model_scope
				system_type
				instance_system_id
			}
			description
			product_type
			is_resolved
			product_components {
				product_ref
			}
		}
		operation_types
		task_measures {
			dtr_code
			value
			uom
			user_uom
		}
	}
}
`
    });
    res.status(200).send(data);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});

app.get('/bff/:orgId/crop-list', async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(401).send('Org id not found :( ');
    }
    const { data } = await axios.get(`https://xyyt5xc4qc.execute-api.us-east-2.amazonaws.com/dev/dev-analytics/v1/yield/organization/1/crops`);
    const simpleContent = data.map((value) => {
      return {
        ...value,
        label: `${value.crop_id} - ${value.year}`,
        value: `${value.crop_id} - ${value.year}`,
        title: value.year
      }
    });
    res.status(200).send(simpleContent);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});

app.get('/bff/engine/fields/:qtd', async (req, res) => {
  try {
    const { qtd } = req.params;
    // if (!orgId) {
    // 	return res.status(401).send('Org id not found :( ');
    // }
    const { data } = await axios.get(`https://xyyt5xc4qc.execute-api.us-east-2.amazonaws.com/dev/dev-analytics/v1/yield/organization/${qtd}/crop/GLXMA/year/2023`);
    const simpleContent = data.map((value) => {
      const idx = Math.floor(Math.random() * mockFields.length);
      const field = mockFields[idx];
      const id = randomUUID();
      return {
        ...value,
        ...field,
        id,
        value: id,
      }
    });
    res.status(200).send(simpleContent);
  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});

//######## server-side event (event stream)
app.get('/status', (request, response) => {
  return response.json({ clients: clients.length });
});

let clients = [];
let facts = [];

function eventsHandler(request, response, next) {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  response.writeHead(200, headers);

  // the "data" word, mean the type of content
  // u can use "event" -> `event: ${event_name}\n\n`;
  //to create event listeners on front-end
  const data = `data: ${JSON.stringify(facts)}\n\n`;

  response.write(data);

  // const clientId = Date.now();
  const clientId = randomUUID();

  const newClient = {
    id: clientId,
    response
  };

  clients.push(newClient);

  request.on('close', () => {
    console.log(`Client: ${clientId} - Connection closed`);
    clients = clients.filter(client => client.id !== clientId);
  });
}

app.get('/events', eventsHandler);


function sendEventsToAll(newFact) {
  clients.forEach(client => client.response.write(`data: ${JSON.stringify(newFact)}\n\n`))
}

async function addFact(request, respsonse, next) {
  const newFact = request.body;
  facts.push(newFact);
  respsonse.json(newFact)
  return sendEventsToAll(newFact);
}

app.post('/fact', addFact);
//### SSE end

async function* processFarmsAndFields(orgId) {
  try {
    const { data: { content } } = await axios.get(`${BASE_URL}/orgs/${orgId}/properties`);
    const farmsData = content.map((value) => {
      return {
        name: value.name,
        id: value.id,
        orgId: value.org_id,
        label: value.name,
        value: value.id
      }
    });
    for (const farm of farmsData) {
      try {
        const { data: { content } } = await axios.get(`${BASE_URL}/properties/${farm.id}/fields?attributes=geometry`);
        const simpleContent = content.map((value) => {
          return {
            name: value.name,
            farmId: value.property_id,
            id: value.id,
            area: value.calculated_area,
            centroid: value.reference_point,
            geometry: value.geometry,
            orgId
          }
        });
        yield simpleContent;
      } catch (err) {
        yield [];
      }
    }
  } catch (err) {
    yield [];
  }
}


app.get('/bff/org/:orgId/fields', async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(401).send('Org id not found :( ');
    }

    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    let cnClosed = false;
    req.on('close', () => {
      cnClosed = true;
      console.log(`Client: ${randomUUID()} - Connection closed`);
    });

    for await (const fields of processFarmsAndFields(orgId)) {
      if (cnClosed) break;
      const data = {
        type: 'data',
        fields,
      }
      const content = `data: ${JSON.stringify(data)}\n\n`;
      res.write(content);
    }

    const data = {
      type: 'end',
      fields: [],
    }
    const content = `data: ${JSON.stringify(data)}\n\n`;
    res.write('event: doneEvent\n');
    res.write(content);

  } catch (err) {
    console.log(err)
    res.status(404).send([])
  }
});
// starting the server
app.listen(PORT, () => {
  console.log(`BFF on port ${PORT}`);
});