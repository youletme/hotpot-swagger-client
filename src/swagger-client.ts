import Swagger, {OperationsDict} from "./swagger";
import {OpenAPIV2} from "./openapi-types";
import {Dict, FetchOptions} from "./utils";

export class OperationNotFoundError implements Error {
  message: string;
  name: string;
}

export class RequiredParameterMissError implements Error {
  message: string;
  name: string;
}

export class SchemaNotAllowError implements Error {
  message: string;
  name: string;
}

export default class SwaggerClient {
  private _operations: Dict<OperationsDict>;
  private _swagger: Swagger;

  constructor(operations: Dict<OperationsDict>, swagger: Swagger) {
    this._operations = operations;
    this._swagger = swagger;
  }

  exec(operation: string, parameters: any): Promise<any> {
    const url = this.buildUrl(operation, parameters);
    const options = this.buildRequestOptions(operation, parameters);

    return this._swagger.fetch(url, options);
  }

  private _getOperation(name: string): OperationsDict {
    if (this._operations['id:' + name] !== undefined ) {
      return this._operations['id:' + name];
    }

    if (this._operations['path:' + name] === undefined) {
      throw new OperationNotFoundError();
    }

    return this._operations['path:' + name];
  }

  buildUrl(operation: string, params: any): string {
    const op = this._getOperation(operation);
    const spec = this._swagger.spec;

    let path = op.path;
    let schema = spec.schemes.length > 0 ? spec.schemes[0]: 'https';

    if (op.operation.parameters !== undefined) {
      op.operation.parameters.forEach((p) => {
        // @ts-ignore
        if (p.in === undefined) {
          return;
        }
        const dp: OpenAPIV2.Parameter = p as OpenAPIV2.Parameter;

        if (dp.required) {
          if (params[dp.name] === undefined) {
            throw new RequiredParameterMissError();
          }
        }

        if (dp.in === 'path') {
          path = path.replace(`{${dp.name}}`, params[dp.name]);
        }

        if (dp.in === 'query') {
          if (path.match(/\?/) === null) {
            path = `${path}?${dp.name}=${params[dp.name]}`;
          }
          else {
            path = `${path}&${dp.name}=${params[dp.name]}`;
          }
        }
      });
    }

    if (params['schema'] !== undefined) {

      if (spec.schemes[params['schema']] === undefined) {
        throw new SchemaNotAllowError();
      }

      schema = params['schema'];
    }

    return schema + '://' + this._swagger.baseUrl + path;
  }

  buildRequestOptions(operation: string, params: any): FetchOptions {
    const op = this._getOperation(operation);

    let headers = {};
    let body = {};

    if (op.operation.consumes !== undefined) {
      headers = Object.assign(headers, {
        'content-type': op.operation.consumes.join(";")
      })
    }

    if (op.operation.produces !== undefined) {
      headers = Object.assign(headers, {
        'accept': op.operation.produces
      })
    }

    if (op.operation.parameters !== undefined) {
      op.operation.parameters.forEach((p) => {
        // @ts-ignore
        if (p.in === undefined) {
          return;
        }
        const dp: OpenAPIV2.Parameter = p as OpenAPIV2.Parameter;

        if (dp.in === 'body') {
          body = params['body'];
        }

        if (dp.in === 'formData' && params[dp.name] !== undefined) {
          body = Object.assign({}, body, {
            [dp.name]: params[dp.name],
          })
        }

        if (dp.in === 'header' &&  params[dp.name] !== undefined) {
          headers = Object.assign({}, headers, {
            [dp.name]: params[dp.name],
          })
        }
      });
    }

    return {
      method: op.method,
      headers,
      body
    }
  }
}
