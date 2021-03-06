import { getOidcToken } from '../utils/helpers';

class GoogleCloudApi {
  setOidcStorageKey(oidcStorageKey) {
    if (!oidcStorageKey) console.error('OIDC storage key is empty');
    this.oidcStorageKey = oidcStorageKey;
  }

  get fetchConfig() {
    if (!this.oidcStorageKey) throw new Error('OIDC storage key is not set');
    const accessToken = getOidcToken(this.oidcStorageKey);
    if (!accessToken) throw new Error('OIDC access_token is not set');
    return {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    };
  }

  get urlBase() {
    return `https://healthcare.googleapis.com/v1beta1`;
  }

  get urlBaseProject() {
    return this.urlBase + `/projects`;
  }

  async doRequest(urlStr, config = {}, params = {}) {
    const url = new URL(urlStr);
    let data = null;
    url.search = new URLSearchParams(params);

    try {
      const response = await fetch(url, { ...this.fetchConfig, config });
      try {
        data = await response.json();
      } catch (err) {}
      if (response.status >= 200 && response.status < 300 && data != null) {
        if (data.nextPageToken != null) {
          params.pageToken = data.nextPageToken;
          let subPage = await this.doRequest(urlStr, config, params);
          for (let key in data) {
            if (data.hasOwnProperty(key)) {
              data[key] = data[key].concat(subPage.data[key]);
            }
          }
        }
        return {
          isError: false,
          status: response.status,
          data,
        };
      } else {
        return {
          isError: true,
          status: response.status,
          message:
            (data && data.error && data.error.message) || 'Unknown error',
        };
      }
    } catch (err) {
      if (data && data.error) {
        return {
          isError: true,
          status: err.status,
          message: err.response.data.error.message || 'Unspecified error',
        };
      }
      return {
        isError: true,
        message: (err && err.message) || 'Oops! Something went wrong',
      };
    }
  }

  async loadProjects() {
    return this.doRequest(
      'https://cloudresourcemanager.googleapis.com/v1/projects'
    );
  }

  async loadLocations(projectId) {
    return this.doRequest(`${this.urlBaseProject}/${projectId}/locations`);
  }

  async loadDatasets(projectId, locationId) {
    return this.doRequest(
      `${this.urlBaseProject}/${projectId}/locations/${locationId}/datasets`
    );
  }

  async loadDicomStores(dataset) {
    return this.doRequest(`${this.urlBase}/${dataset}/dicomStores`);
  }
}

export default new GoogleCloudApi();
