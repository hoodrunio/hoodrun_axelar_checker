import { ConsensusPubkey } from "@services/rest/interfaces/validators/validator";
import { sha256 } from "@cosmjs/crypto";
import { toBech32, fromBase64 } from "@cosmjs/encoding";

export enum ADDRESS_TYPE_PREFIX {
  VALOPER = "axelarvaloper",
  VALCONSENSUS = "axelarvalcons",
}
export const convertPubKeyToBech32 = (
  pubKey: ConsensusPubkey,
  addressType: ADDRESS_TYPE_PREFIX
): string => {
  const ed25519PubkeyRaw = fromBase64(pubKey.key);
  const addressData = sha256(ed25519PubkeyRaw).slice(0, 20);
  const bech32Address = toBech32(addressType, addressData);

  return bech32Address;
};
