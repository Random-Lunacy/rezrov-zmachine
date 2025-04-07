export interface CallFrame {
  method_pc: number;
  return_pc: number;
  return_value_location: number | null;
  locals: Array<number>;
  arg_count: number;
}
