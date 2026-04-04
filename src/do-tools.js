const axios = require("axios");

const DO_BASE = "https://api.digitalocean.com/v2";

function doClient() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN environment variable is not set");
  return axios.create({
    baseURL: DO_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

// List all apps
async function listApps() {
  const client = doClient();
  const response = await client.get("/apps");
  return (response.data.apps || []).map((a) => ({
    id: a.id,
    name: a.spec?.name,
    defaultIngress: a.default_ingress,
    activeDeploymentId: a.active_deployment?.id,
    activeDeploymentPhase: a.active_deployment?.phase,
    updatedAt: a.updated_at,
    region: a.region?.slug,
  }));
}

// Get a single app's details
async function getApp({ appId }) {
  if (!appId) throw new Error("appId is required");
  const client = doClient();
  const response = await client.get(`/apps/${appId}`);
  const a = response.data.app;
  return {
    id: a.id,
    name: a.spec?.name,
    defaultIngress: a.default_ingress,
    activeDeployment: a.active_deployment
      ? {
          id: a.active_deployment.id,
          phase: a.active_deployment.phase,
          createdAt: a.active_deployment.created_at,
          updatedAt: a.active_deployment.updated_at,
          cause: a.active_deployment.cause,
        }
      : null,
    inProgressDeployment: a.in_progress_deployment
      ? {
          id: a.in_progress_deployment.id,
          phase: a.in_progress_deployment.phase,
          createdAt: a.in_progress_deployment.created_at,
          cause: a.in_progress_deployment.cause,
        }
      : null,
    region: a.region?.slug,
    updatedAt: a.updated_at,
  };
}

// List deployments for an app
async function listDeployments({ appId, limit = 10 }) {
  if (!appId) throw new Error("appId is required");
  const client = doClient();
  const response = await client.get(`/apps/${appId}/deployments`, {
    params: { per_page: limit },
  });
  return (response.data.deployments || []).map((d) => ({
    id: d.id,
    phase: d.phase,
    cause: d.cause,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    cloneUrl: d.services?.[0]?.source_commit_hash,
  }));
}

// Get a specific deployment
async function getDeployment({ appId, deploymentId }) {
  if (!appId) throw new Error("appId is required");
  if (!deploymentId) throw new Error("deploymentId is required");
  const client = doClient();
  const response = await client.get(`/apps/${appId}/deployments/${deploymentId}`);
  const d = response.data.deployment;
  return {
    id: d.id,
    phase: d.phase,
    cause: d.cause,
    progress: d.progress,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// Trigger a new deployment (redeploy)
async function createDeployment({ appId, forceBuild = false }) {
  if (!appId) throw new Error("appId is required");
  const client = doClient();
  const response = await client.post(`/apps/${appId}/deployments`, {
    force_build: forceBuild,
  });
  const d = response.data.deployment;
  return {
    id: d.id,
    phase: d.phase,
    cause: d.cause,
    createdAt: d.created_at,
  };
}

// Get deployment logs
async function getDeploymentLogs({ appId, deploymentId, component, logType = "BUILD" }) {
  if (!appId) throw new Error("appId is required");
  if (!deploymentId) throw new Error("deploymentId is required");
  if (!component) throw new Error("component name is required");
  const client = doClient();
  const response = await client.get(
    `/apps/${appId}/deployments/${deploymentId}/components/${component}/logs`,
    { params: { type: logType, follow: false } }
  );
  return {
    liveUrl: response.data.live_url,
    historicUrls: response.data.historic_urls,
  };
}

// Get app logs (active deployment)
async function getAppLogs({ appId, component, logType = "RUN" }) {
  if (!appId) throw new Error("appId is required");
  if (!component) throw new Error("component name is required");
  const client = doClient();
  const response = await client.get(`/apps/${appId}/logs`, {
    params: { type: logType, component_name: component, follow: false },
  });
  return {
    liveUrl: response.data.live_url,
    historicUrls: response.data.historic_urls,
  };
}

// Cancel a deployment
async function cancelDeployment({ appId, deploymentId }) {
  if (!appId) throw new Error("appId is required");
  if (!deploymentId) throw new Error("deploymentId is required");
  const client = doClient();
  const response = await client.post(
    `/apps/${appId}/deployments/${deploymentId}/cancel`
  );
  const d = response.data.deployment;
  return {
    id: d.id,
    phase: d.phase,
  };
}

// Restart an app (no new build, just restarts the running service)
async function restartApp({ appId }) {
  if (!appId) throw new Error("appId is required");
  const client = doClient();
  await client.post(`/apps/${appId}/rollback/revert`).catch(() => {
    // revert rollback not available, try restart via empty deployment
  });
  // DigitalOcean doesn't have a direct "restart" — use force rebuild
  const response = await client.post(`/apps/${appId}/deployments`, {
    force_build: true,
  });
  const d = response.data.deployment;
  return { id: d.id, phase: d.phase, message: "Force rebuild triggered" };
}

module.exports = {
  listApps,
  getApp,
  listDeployments,
  getDeployment,
  createDeployment,
  getDeploymentLogs,
  getAppLogs,
  cancelDeployment,
  restartApp,
};
