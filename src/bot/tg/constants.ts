//Please be aware that this variable will be used on telegram bot commands initilization so that is why we have to stick with their rules
//Which means that we have to use snake_case for commands
export const Commands = {
  AddOperatorAddress: {
    command: "add_operator_address",
    description:
      "Add operator address to monitor.Usage -> /add_operator_address axelarvaloper1...",
    validate: (text: string): boolean => {
      const regex = /\/add_operator_address\saxelarvaloper.{39}$/;
      return regex.test(text);
    },
  },
  ListValidators: {
    command: "list_validators",
    description: "List all validators",
  },
};

export const TgQuery = {
  UpTime: {
    prefix: "uptime",
    separator: ":",
  },
  ValActions: {
    prefix: "valActions",
    separator: ":",
  },
};
