type NestedInformation = { name: { firstName: string; lastName: string } };

/**
 * @openapi
 * components:
 *   schemas:
 *     PersonInformation:
 *       type: object
 *       properties:
 *         name:
 *           type: object
 *           properties:
 *             firstName:
 *               $ref: "#/components/schemas/FirstName"
 *             lastName:
 *               $ref: "#/components/schemas/LastName"
 */
export type PersonInformation = NestedInformation & {
  [key: string]: string | boolean | NestedInformation[keyof NestedInformation]; // having NestedInformation[keyof NestedInformation] makes type looser here because of this https://github.com/microsoft/TypeScript/issues/17867. Possible/future solution https://github.com/microsoft/TypeScript/pull/29317
};

/**
 * This and contained types are copied from Flex
 *
 * @openapi
 * components:
 *   schemas:
 *     ContactCaseInformation:
 *       type: object
 *       properties:
 *         categories:
 *           type: string
 *     ContactRawJson:
 *       type: object
 *       properties:
 *         definitionVersion:
 *           type: string
 *         callType:
 *           type: string
 *         childInformation:
 *           $ref: '#/components/schemas/PersonInformation'
 *         callerInformation:
 *           $ref: '#/components/schemas/PersonInformation'
 *         caseInformation:
 *           $ref: '#/components/schemas/ContactCaseInformation'
 *         contactlessTask:
 *           type: string
 */
export type ContactRawJson = {
  definitionVersion?: string;
  callType: string;
  childInformation: PersonInformation;
  callerInformation?: PersonInformation;
  caseInformation: {
    categories: Record<string, Record<string, boolean>>;
    [key: string]: string | boolean | Record<string, Record<string, boolean>>;
  };
  contactlessTask?: { [key: string]: string | boolean };
};
