import {
    ArrayProperty,
    BooleanProperty,
    buildPropertyFrom,
    EntitySchema,
    EntityValues,
    GeopointProperty,
    NumberProperty,
    Properties,
    PropertiesOrBuilder,
    Property,
    PropertyOrBuilder,
    ReferenceProperty,
    StringProperty,
    TimestampProperty
} from "../models";
import * as yup from "yup";
import {
    AnySchema,
    ArraySchema,
    BooleanSchema,
    DateSchema,
    NumberSchema,
    ObjectSchema,
    StringSchema
} from "yup";
import { enumToObjectEntries } from "../util/enums";

export type CustomFieldValidator = (name: string, value: any) => Promise<boolean>;


export function mapPropertyToYup(property: Property, customFieldValidator?: CustomFieldValidator, name?: string): AnySchema<unknown> {

    if (property.dataType === "string") {
        return getYupStringSchema(property, name, customFieldValidator);
    } else if (property.dataType === "number") {
        return getYupNumberSchema(property, name, customFieldValidator);
    } else if (property.dataType === "boolean") {
        return getYupBooleanSchema(property, name, customFieldValidator);
    } else if (property.dataType === "map") {
        if (!property.properties) {
            return yup.object();
        }
        return getYupMapObjectSchema(property.properties, customFieldValidator, name);
    } else if (property.dataType === "array") {
        return getYupArraySchema(property, customFieldValidator);
    } else if (property.dataType === "timestamp") {
        return getYupDateSchema(property, name, customFieldValidator);
    } else if (property.dataType === "geopoint") {
        return getYupGeoPointSchema(property, name, customFieldValidator);
    } else if (property.dataType === "reference") {
        return getYupReferenceSchema(property, name, customFieldValidator);
    }
    throw Error("Unsupported data type in yup mapping: " + property);
}

export function getYupEntitySchema<S extends EntitySchema<Key>, Key extends string>
(properties: PropertiesOrBuilder<S, Key>,
 values: Partial<EntityValues<S, Key>>,
 customFieldValidator?: CustomFieldValidator,
 entityId?: string): ObjectSchema<any> {
    const objectSchema: any = {};
    Object.entries(properties).forEach(([name, propertyOrBuilder]) => {
        objectSchema[name] = mapPropertyToYup(buildPropertyFrom(propertyOrBuilder as PropertyOrBuilder<S, Key>, values, entityId), customFieldValidator, name);
    });
    return yup.object().shape(objectSchema);
}

export function getYupMapObjectSchema<S extends EntitySchema<Key>, Key extends string>(
    properties: Properties<any>,
    customFieldValidator?: CustomFieldValidator,
    name?: string
): ObjectSchema<any> {
    const objectSchema: any = {};
    Object.entries(properties).forEach(([childName, property]: [string, Property]) => {
        objectSchema[childName] = mapPropertyToYup(property, customFieldValidator, `${name}[${childName}]`);
    });
    return yup.object().shape(objectSchema);
}

function getYupStringSchema(property: StringProperty, name?:string, uniqueFieldChecker?: CustomFieldValidator): StringSchema {
    let schema: StringSchema<any> = yup.string();
    const validation = property.validation;
    if (property.config?.enumValues) {
        if (validation?.required)
            schema = schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required");
        schema = schema.oneOf(
            enumToObjectEntries(property.config?.enumValues)
                .map(([key, _]) => key)
        );
    }
    if (validation) {
        schema = validation.required ?
            schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
        if (validation.min || validation.min === 0) schema = schema.min(validation.min, `${property.title} must be min ${validation.min} characters long`);
        if (validation.max || validation.max === 0) schema = schema.max(validation.max, `${property.title} must be max ${validation.max} characters long`);
        if (validation.matches) schema = schema.matches(validation.matches);
        if (validation.email) schema = schema.email(`${property.title} must be an email`);
        if (validation.url) schema = schema.url(`${property.title} must be a url`);
        if (validation.trim) schema = schema.trim();
        if (validation.lowercase) schema = schema.lowercase();
        if (validation.uppercase) schema = schema.uppercase();
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupNumberSchema(property: NumberProperty, name?:string, uniqueFieldChecker?: CustomFieldValidator): NumberSchema {
    const validation = property.validation;
    let schema: NumberSchema<any> = yup.number().typeError("Must be a number");
    if (validation) {
        schema = validation.required ?
            schema.required(validation.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
        if (validation.min || validation.min === 0) schema = schema.min(validation.min, `${property.title} must be higher or equal to ${validation.min}`);
        if (validation.max || validation.max === 0) schema = schema.max(validation.max, `${property.title} must be lower or equal to ${validation.max}`);
        if (validation.lessThan || validation.lessThan === 0) schema = schema.lessThan(validation.lessThan, `${property.title} must be higher than ${validation.lessThan}`);
        if (validation.moreThan || validation.moreThan === 0) schema = schema.moreThan(validation.moreThan, `${property.title} must be lower than ${validation.moreThan}`);
        if (validation.positive) schema = schema.positive(`${property.title} must be positive`);
        if (validation.negative) schema = schema.negative(`${property.title} must be negative`);
        if (validation.integer) schema = schema.integer(`${property.title} must be an integer`);
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupGeoPointSchema(property: GeopointProperty, name?:string, uniqueFieldChecker?: CustomFieldValidator): AnySchema {
    let schema: ObjectSchema<any> = yup.object();
    const validation = property.validation;
    if (validation?.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
    if (validation?.required) {
        schema = schema.required(validation.requiredMessage).nullable(true);
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupDateSchema(property: TimestampProperty, name?:string, uniqueFieldChecker?: CustomFieldValidator): AnySchema | DateSchema {
    if (property.autoValue) {
        return yup.object().nullable(true);
    }
    let schema: DateSchema<any> = yup.date();
    const validation = property.validation;
    if (validation) {
        schema = validation.required ?
            schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
        if (validation.min) schema = schema.min(validation.min, `${property.title} must be after ${validation.min}`);
        if (validation.max) schema = schema.max(validation.max, `${property.title} must be before ${validation.min}`);
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupReferenceSchema<S extends EntitySchema>(property: ReferenceProperty<S, any>, name?:string, uniqueFieldChecker?: CustomFieldValidator): AnySchema {
    let schema: ObjectSchema<any> = yup.object();
    const validation = property.validation;
    if (validation) {
        schema = validation.required ?
            schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupBooleanSchema(property: BooleanProperty, name?:string, uniqueFieldChecker?: CustomFieldValidator): BooleanSchema {
    let schema: BooleanSchema<any> = yup.boolean();
    const validation = property.validation;
    if (validation) {
        schema = validation.required ?
            schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.unique && uniqueFieldChecker && name) schema = schema.test("unique", `There is another entity with this value and it should be unique`, (value) => uniqueFieldChecker(name,value));
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}

function getYupArraySchema<T>(property: ArrayProperty<T>, customFieldValidator?: CustomFieldValidator, name?: string): ArraySchema<any> {

    let schema: ArraySchema<any> = yup.array();

    if (property.of)
        schema = schema.of(mapPropertyToYup(property.of, customFieldValidator, name));
    const validation = property.validation;

    if (validation) {
        schema = validation.required ?
            schema.required(validation?.requiredMessage ? validation.requiredMessage : "Required").nullable(true) :
            schema.notRequired().nullable(true);
        if (validation.min || validation.min === 0) schema = schema.min(validation.min, `${property.title} should be min ${validation.min} entries long`);
        if (validation.max) schema = schema.max(validation.max, `${property.title} should be max ${validation.min} entries long`);
    } else {
        schema = schema.notRequired().nullable(true);
    }
    return schema;
}
