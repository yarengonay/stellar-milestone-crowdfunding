import {ProjectState} from './types.js';
import {Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';

export interface Client {
  vote({ donor, approve }: { donor: string | Address; approve: boolean }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  pledge({ donor, amount }: { donor: string | Address; amount: bigint }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  refund({ donor }: { donor: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_admin(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  get_state(options?: MethodOptions): Promise<AssembledTransaction<ProjectState>>;
  get_token(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  get_votes(options?: MethodOptions): Promise<AssembledTransaction<[bigint, bigint]>>;
  get_target(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  initialize({ admin, token, target, deadline, milestones }: { admin: string | Address; token: string | Address; target: bigint; deadline: bigint; milestones: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_deadline(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  submit_proof({ proof_url }: { proof_url: string }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_proof_url(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  get_donor_amount({ donor }: { donor: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  get_total_pledged(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  resolve_milestone(options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_milestone_count(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  get_current_milestone(options?: MethodOptions): Promise<AssembledTransaction<number>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAAAAAAAEdm90ZQAAAAIAAAAAAAAABWRvbm9yAAAAAAAAEwAAAAAAAAAHYXBwcm92ZQAAAAABAAAAAA==", "AAAAAAAAAAAAAAAGcGxlZGdlAAAAAAACAAAAAAAAAAVkb25vcgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=", "AAAAAAAAAAAAAAAGcmVmdW5kAAAAAAABAAAAAAAAAAVkb25vcgAAAAAAABMAAAAA", "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT", "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAfQAAAADFByb2plY3RTdGF0ZQ==", "AAAAAAAAAAAAAAAJZ2V0X3Rva2VuAAAAAAAAAAAAAAEAAAAT", "AAAAAAAAAAAAAAAJZ2V0X3ZvdGVzAAAAAAAAAAAAAAEAAAPtAAAAAgAAAAsAAAAL", "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAADQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAFVG9rZW4AAAAAAAAAAAAAAAAAAAxUYXJnZXRBbW91bnQAAAAAAAAAAAAAAAhEZWFkbGluZQAAAAAAAAAAAAAADk1pbGVzdG9uZUNvdW50AAAAAAAAAAAAAAAAABBDdXJyZW50TWlsZXN0b25lAAAAAAAAAAAAAAAMUHJvamVjdFN0YXRlAAAAAQAAAAAAAAALRG9ub3JBbW91bnQAAAAAAQAAABMAAAABAAAAAAAAAApEb25vclZvdGVkAAAAAAABAAAAEwAAAAAAAAAAAAAACFllc1ZvdGVzAAAAAAAAAAAAAAAHTm9Wb3RlcwAAAAAAAAAAAAAAAAhQcm9vZlVybAAAAAAAAAAAAAAADFRvdGFsUGxlZGdlZA==", "AAAAAAAAAAAAAAAKZ2V0X3RhcmdldAAAAAAAAAAAAAEAAAAL", "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABnRhcmdldAAAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAptaWxlc3RvbmVzAAAAAAAEAAAAAA==", "AAAAAAAAAAAAAAAMZ2V0X2RlYWRsaW5lAAAAAAAAAAEAAAAG", "AAAAAAAAAAAAAAAMc3VibWl0X3Byb29mAAAAAQAAAAAAAAAJcHJvb2ZfdXJsAAAAAAAAEAAAAAA=", "AAAAAAAAAAAAAAANZ2V0X3Byb29mX3VybAAAAAAAAAAAAAABAAAAEA==", "AAAAAwAAAAAAAAAAAAAADFByb2plY3RTdGF0ZQAAAAQAAAAAAAAAB0Z1bmRpbmcAAAAAAAAAAAAAAAAGVm90aW5nAAAAAAABAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAACAAAAAAAAAAZGYWlsZWQAAAAAAAM=", "AAAAAAAAAAAAAAAQZ2V0X2Rvbm9yX2Ftb3VudAAAAAEAAAAAAAAABWRvbm9yAAAAAAAAEwAAAAEAAAAL", "AAAAAAAAAAAAAAARZ2V0X3RvdGFsX3BsZWRnZWQAAAAAAAAAAAAAAQAAAAs=", "AAAAAAAAAAAAAAARcmVzb2x2ZV9taWxlc3RvbmUAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAATZ2V0X21pbGVzdG9uZV9jb3VudAAAAAAAAAAAAQAAAAQ=", "AAAAAAAAAAAAAAAVZ2V0X2N1cnJlbnRfbWlsZXN0b25lAAAAAAAAAAAAAAEAAAAE"]),
      options
    );
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { wasmHash: Buffer | string; salt?: Buffer | Uint8Array; format?: "hex" | "base64"; address?: string; }): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJSON = {
    vote : this.txFromJSON<void>,  pledge : this.txFromJSON<void>,  refund : this.txFromJSON<void>,  get_admin : this.txFromJSON<string>,  get_state : this.txFromJSON<ProjectState>,  get_token : this.txFromJSON<string>,  get_votes : this.txFromJSON<[bigint, bigint]>,  get_target : this.txFromJSON<bigint>,  initialize : this.txFromJSON<void>,  get_deadline : this.txFromJSON<bigint>,  submit_proof : this.txFromJSON<void>,  get_proof_url : this.txFromJSON<string>,  get_donor_amount : this.txFromJSON<bigint>,  get_total_pledged : this.txFromJSON<bigint>,  resolve_milestone : this.txFromJSON<void>,  get_milestone_count : this.txFromJSON<number>,  get_current_milestone : this.txFromJSON<number>
  };
}