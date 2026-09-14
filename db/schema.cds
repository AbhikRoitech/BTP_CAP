namespace cap01;

using { cuid, managed } from '@sap/cds/common';

entity Products : cuid, managed {
  name        : String(111);
  description : String(1111);
  price       : Decimal(9,2);
  stock       : Integer;
}
