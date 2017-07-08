export interface InputOptions {
  [key: string]: InputType
}
export type InputType = {
  default: string | number | boolean;
  type: String | Number | Boolean;
};
