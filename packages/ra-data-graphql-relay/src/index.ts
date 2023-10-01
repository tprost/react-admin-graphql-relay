import merge from 'lodash/merge';
import buildDataProvider, { BuildQueryFactory, Options } from 'ra-data-graphql';
import { DataProvider, Identifier } from 'ra-core';
import pluralize from 'pluralize';
import {
    DataProvider,
    HttpError,
    GET_LIST,
    GET_ONE,
    GET_MANY,
    GET_MANY_REFERENCE,
    CREATE,
    UPDATE,
    DELETE,
    DELETE_MANY,
    UPDATE_MANY,
} from 'ra-core';

import defaultBuildQuery from './buildQuery';
const defaultOptions = {
    buildQuery: defaultBuildQuery,
    introspection: {
        operationNames: {
            [GET_LIST]: resource => `${pluralize(resource.name).decapitalize()}`,
            [GET_ONE]: resource => `${resource.name}.decapitalize()`,
            [GET_MANY]: resource => `all${pluralize(resource.name)}`,
            [GET_MANY_REFERENCE]: resource => `all${pluralize(resource.name)}`,
            [CREATE]: resource => `create${resource.name}`,
            [UPDATE]: resource => `update${resource.name}`,
            [DELETE]: resource => `delete${resource.name}`,
        },
    }
};

export const buildQuery = defaultBuildQuery;

export default (
    options: Omit<Options, 'buildQuery'> & { buildQuery?: BuildQueryFactory }
): Promise<DataProvider> => {
    return buildDataProvider(merge({}, defaultOptions, options)).then(
        defaultDataProvider => {
            return {
                ...defaultDataProvider,
                // This provider does not support multiple deletions so instead we send multiple DELETE requests
                // This can be optimized using the apollo-link-batch-http link
                deleteMany: (resource, params) => {
                    const { ids, ...otherParams } = params;
                    return Promise.all(
                        ids.map(id =>
                            defaultDataProvider.delete(resource, {
                                id,
                                previousData: null,
                                ...otherParams,
                            })
                        )
                    ).then(results => {
                        const data = results.reduce<Identifier[]>(
                            (acc, { data }) => [...acc, data.id],
                            []
                        );

                        return { data };
                    });
                },
                // This provider does not support multiple deletions so instead we send multiple UPDATE requests
                // This can be optimized using the apollo-link-batch-http link
                updateMany: (resource, params) => {
                    const { ids, data, ...otherParams } = params;
                    return Promise.all(
                        ids.map(id =>
                            defaultDataProvider.update(resource, {
                                id,
                                data: data,
                                previousData: null,
                                ...otherParams,
                            })
                        )
                    ).then(results => {
                        const data = results.reduce<Identifier[]>(
                            (acc, { data }) => [...acc, data.id],
                            []
                        );

                        return { data };
                    });
                },
            };
        }
    );
};
