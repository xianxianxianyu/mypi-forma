import { assertBoundedValue } from '../limits';
import { colorFunctions } from "./colors";
import { dataFunctions } from "./data";
import { dateFunctions } from "./dates";
import { listFunctions } from "./lists";
import { numberFunctions } from "./numbers";
import { textFunctions } from "./text";

/**
 * Generic functions the model calls as @Name(args) to compute inside a page:
 * edit lists held in $variables, do the math, format text and dates, and
 * shape Query rows for charts. They are pure except @Random, @Pick, @Shuffle
 * and @Now. Bad arguments, or a throw, make a call evaluate to null.
 */
const importedFunctions = [...listFunctions, ...numberFunctions, ...textFunctions, ...colorFunctions, ...dateFunctions, ...dataFunctions];
export const functions = importedFunctions.map((definition) => ({
  ...definition,
  fn: (params: Record<string, unknown>) => {
    assertBoundedValue(params);
    const result = (definition.fn as (params: Record<string, unknown>) => unknown)(params);
    assertBoundedValue(result);
    return result;
  },
}));
