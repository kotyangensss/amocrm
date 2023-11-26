import { BadRequestException, Injectable } from '@nestjs/common';
import * as process from 'process';

@Injectable()
export class AppService {
  private access_token = null;
  private refresh_token = process.env.REFRESH_TOKEN;
  private expires = new Date();

  async getContact(query: any): Promise<string> {
    if (
      query.name == undefined ||
      query.email == undefined ||
      query.phone == undefined
    ) {
      throw new BadRequestException('name / email / phone not defined');
    }

    if (this.access_token == null || new Date() > this.expires) {
      await this.getAccessToken().then(() => {
        return this.requestChain(query);
      });
    } else {
      return this.requestChain(query);
    }
  }

  private async requestChain(query: any): Promise<string> {
    return await this.sendQueryRequest(query.phone)
      .then((value) => {
        if (value == null) {
          return this.sendQueryRequest(query.email);
        } else {
          return value;
        }
      })
      .then((value) => {
        if (value == null) {
          return this.sendPostContactRequest(query);
        } else {
          return this.sendPatchContactRequest(value, query);
        }
      })
      .then((value) => {
        return this.sendLead(value);
      });
  }

  private async getAccessToken(): Promise<string> {
    this.expires = new Date();
    const response = await fetch(
      `https://${process.env.SUBDOMAIN}.amocrm.ru/oauth2/access_token`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: process.env.INTEGRATION_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: this.refresh_token,
          redirect_uri: process.env.REDIRECT_URI,
        }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }

    return await response.json().then((value) => {
      this.access_token = value.access_token;
      this.refresh_token = value.refresh_token;
      this.expires = new Date(this.expires.getTime() + value.expires_in * 1000);
      return value.access_token;
    });
  }

  private async sendQueryRequest(param: string): Promise<string> {
    const response = await fetch(
      `https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4/contacts?query=${param}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.access_token}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }

    if (response.status == 204) {
      return null;
    }

    return (await response.json())._embedded.contacts[0].id;
  }

  private async sendPostContactRequest(query: any): Promise<string> {
    const response = await fetch(
      `https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4/contacts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.access_token}`,
          Accept: 'application/json',
        },
        body: this.postString(query),
      },
    );

    if (!response.ok) {
      throw new Error(`Error! status: ${response.statusText}`);
    }

    return (await response.json())._embedded.contacts[0].id;
  }

  private async sendPatchContactRequest(
    id: string,
    query: any,
  ): Promise<string> {
    const response = await fetch(
      `https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4/contacts`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.access_token}`,
          Accept: 'application/json',
        },
        body: this.patchString(id, query),
      },
    );

    if (!response.ok) {
      throw new Error(`Error! status: ${response.statusText}`);
    }

    return (await response.json())._embedded.contacts[0].id;
  }

  private async sendLead(id: string): Promise<string> {
    const response = await fetch(
      `https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4/leads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.access_token}`,
          Accept: 'application/json',
        },
        body: `[{"_embedded": [{"id": ${id}}]}]`,
      },
    );

    if (!response.ok) {
      throw new Error(`Error! status: ${response.statusText}`);
    }

    return await response.json();
  }
  private postString(query: any): string {
    return (
      '[\n' +
      '          {\n' +
      `            "name": "${query.name}",\n` +
      '            "custom_fields_values": [\n' +
      '              {\n' +
      '                "field_code": "PHONE",\n' +
      '                "field_name": "phone",\n' +
      '                "values": [\n' +
      '                  {\n' +
      `                    \"value\": \"${query.phone}\"\n` +
      '                  }\n' +
      '                ]\n' +
      '              },\n' +
      '              {\n' +
      '                "field_code": "EMAIL",\n' +
      '                "field_name": "email",\n' +
      '                "values": [\n' +
      '                  {\n' +
      `                    \"value\": \"${query.email}\"\n` +
      '                  }\n' +
      '                ]\n' +
      '              }\n' +
      '            ]\n' +
      '          }\n' +
      ']'
    );
  }
  private patchString(id: string, query: any): string {
    return (
      '[\n' +
      '          {\n' +
      `            "id": ${id},\n` +
      `            "name": "${query.name}",\n` +
      '            "custom_fields_values": [\n' +
      '              {\n' +
      '                "field_code": "PHONE",\n' +
      '                "field_name": "phone",\n' +
      '                "values": [\n' +
      '                  {\n' +
      `                    \"value\": \"${query.phone}\"\n` +
      '                  }\n' +
      '                ]\n' +
      '              },\n' +
      '              {\n' +
      '                "field_code": "EMAIL",\n' +
      '                "field_name": "email",\n' +
      '                "values": [\n' +
      '                  {\n' +
      `                    \"value\": \"${query.email}\"\n` +
      '                  }\n' +
      '                ]\n' +
      '              }\n' +
      '            ]\n' +
      '          }\n' +
      ']'
    );
  }
}
