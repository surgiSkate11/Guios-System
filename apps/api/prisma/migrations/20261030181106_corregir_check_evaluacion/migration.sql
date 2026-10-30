-- A CHECK passes when its expression is NULL: "valor BETWEEN 1 AND 4" with a null
-- valor let "not Desconozco and no value" through. Require the value explicitly.
ALTER TABLE "evaluacion_subfactor" DROP CONSTRAINT "evaluacion_subfactor_valor_o_desconozco_check";
ALTER TABLE "evaluacion_subfactor" ADD CONSTRAINT "evaluacion_subfactor_valor_o_desconozco_check"
  CHECK (("desconozco" AND "valor" IS NULL)
      OR (NOT "desconozco" AND "valor" IS NOT NULL AND "valor" BETWEEN 1 AND 4));
