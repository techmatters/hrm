export type Resource = {
  id: string;
  name: string;
  accountSid: string;
  attributes: {
    inlineCategories: string[];
    referenceCategories: { id: string; value: string }[];
    created: string;
    city: string;
    postalCode: string;
    virtual: boolean;
  };
};

export type Reference = {
  id: string;
  key: string;
  value: string;
  accountSid: string;
};
