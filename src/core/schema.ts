export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface SchemaDefinition {
    type: SchemaType;
    items?: SchemaDefinition;
    properties?: Record<string, SchemaDefinition>;
    required?: boolean;
}

export type Schema = Record<string, SchemaDefinition>;

export function validate(data: any, schema: SchemaDefinition): boolean {
    if (data === undefined || data === null) return !schema.required;
    if (schema.type === 'array') {
        if (!Array.isArray(data)) return false;
        if (schema.items) return data.every(item => validate(item, schema.items!));
        return true;
    }
    if (schema.type === 'object') {
        if (typeof data !== 'object' || Array.isArray(data)) return false;
        if (schema.properties) {
            for (const key in schema.properties) {
                if (!validate(data[key], schema.properties[key])) return false;
            }
        }
        return true;
    }
    return typeof data === schema.type;
}